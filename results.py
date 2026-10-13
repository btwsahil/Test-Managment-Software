from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from database import get_connection
from auth import require_admin

router = APIRouter()


# ---------- Response shapes ----------
class ResultSummary(BaseModel):
    result_id: int
    student_id: int
    student_name: str
    subject_name: str
    topic_name: Optional[str]
    total_questions: int
    correct_answers: int
    wrong_answers: int
    score_percent: float
    weak_topics: List[str]


class StudentPerformance(BaseModel):
    student_id: int
    student_name: str
    tests_taken: int
    average_score: float
    weak_topics: List[str]  # aggregated across all their tests


class SecurityViolationSummary(BaseModel):
    violation_id: int
    session_id: int
    assignment_id: int
    student_id: int
    student_name: str
    subject_name: str
    topic_name: Optional[str]
    violation_type: str
    message: Optional[str]
    occurred_at: datetime


# ---------- Endpoints ----------
@router.get("/admin/results", response_model=List[ResultSummary])
def list_all_results(admin_user: dict = Depends(require_admin)):
    """
    Every completed test result across all students, most recent first.
    This is the main admin analytics view.
    """
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT
            r.result_id, u.user_id as student_id, u.name as student_name,
            s.subject_name, t.topic_name,
            r.total_questions, r.correct_answers, r.wrong_answers,
            r.score_percent, r.weak_topics
        FROM results r
        JOIN sessions se ON r.session_id = se.session_id
        JOIN assignments a ON se.assignment_id = a.assignment_id
        JOIN users u ON a.student_id = u.user_id
        JOIN subjects s ON a.subject_id = s.subject_id
        LEFT JOIN topics t ON a.topic_id = t.topic_id
        ORDER BY r.result_id DESC;
        """
    )
    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    return [
        ResultSummary(
            result_id=row["result_id"], student_id=row["student_id"], student_name=row["student_name"],
            subject_name=row["subject_name"], topic_name=row["topic_name"],
            total_questions=row["total_questions"], correct_answers=row["correct_answers"],
            wrong_answers=row["wrong_answers"], score_percent=float(row["score_percent"]),
            weak_topics=row["weak_topics"].split(",") if row["weak_topics"] else [],
        )
        for row in rows
    ]


@router.get("/admin/results/student/{student_id}", response_model=List[ResultSummary])
def student_results(student_id: int, admin_user: dict = Depends(require_admin)):
    """All results for ONE specific student - useful for a student detail page."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT
            r.result_id, u.user_id as student_id, u.name as student_name,
            s.subject_name, t.topic_name,
            r.total_questions, r.correct_answers, r.wrong_answers,
            r.score_percent, r.weak_topics
        FROM results r
        JOIN sessions se ON r.session_id = se.session_id
        JOIN assignments a ON se.assignment_id = a.assignment_id
        JOIN users u ON a.student_id = u.user_id
        JOIN subjects s ON a.subject_id = s.subject_id
        LEFT JOIN topics t ON a.topic_id = t.topic_id
        WHERE u.user_id = %s
        ORDER BY r.result_id DESC;
        """,
        (student_id,),
    )
    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    if not rows:
        raise HTTPException(status_code=404, detail="No results found for this student")

    return [
        ResultSummary(
            result_id=row["result_id"], student_id=row["student_id"], student_name=row["student_name"],
            subject_name=row["subject_name"], topic_name=row["topic_name"],
            total_questions=row["total_questions"], correct_answers=row["correct_answers"],
            wrong_answers=row["wrong_answers"], score_percent=float(row["score_percent"]),
            weak_topics=row["weak_topics"].split(",") if row["weak_topics"] else [],
        )
        for row in rows
    ]


@router.get("/admin/security/violations", response_model=List[SecurityViolationSummary])
def list_security_violations(admin_user: dict = Depends(require_admin)):
    """Return the exam-security audit trail for all completed and active sessions."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT
            ev.violation_id, ev.session_id, a.assignment_id,
            u.user_id AS student_id, u.name AS student_name,
            s.subject_name, t.topic_name,
            ev.violation_type, ev.message, ev.occurred_at
        FROM exam_violations ev
        JOIN sessions se ON ev.session_id = se.session_id
        JOIN assignments a ON se.assignment_id = a.assignment_id
        JOIN users u ON a.student_id = u.user_id
        JOIN subjects s ON a.subject_id = s.subject_id
        LEFT JOIN topics t ON a.topic_id = t.topic_id
        ORDER BY ev.occurred_at DESC, ev.violation_id DESC;
        """
    )
    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    return [
        SecurityViolationSummary(
            violation_id=row["violation_id"],
            session_id=row["session_id"],
            assignment_id=row["assignment_id"],
            student_id=row["student_id"],
            student_name=row["student_name"],
            subject_name=row["subject_name"],
            topic_name=row["topic_name"],
            violation_type=row["violation_type"],
            message=row["message"],
            occurred_at=row["occurred_at"],
        )
        for row in rows
    ]


@router.get("/admin/results/overview", response_model=List[StudentPerformance])
def performance_overview(admin_user: dict = Depends(require_admin)):
    """
    One row per student: how many tests they've taken, their average score,
    and every weak topic that's shown up across ALL their tests combined.
    This is the "which students/topics need attention" view for the admin dashboard.
    """
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT u.user_id, u.name, r.score_percent, r.weak_topics
        FROM results r
        JOIN sessions se ON r.session_id = se.session_id
        JOIN assignments a ON se.assignment_id = a.assignment_id
        JOIN users u ON a.student_id = u.user_id
        WHERE u.role = 'student';
        """
    )
    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    by_student = {}
    for row in rows:
        sid = row["user_id"]
        by_student.setdefault(sid, {"name": row["name"], "scores": [], "weak_topics": set()})
        by_student[sid]["scores"].append(float(row["score_percent"]))
        if row["weak_topics"]:
            by_student[sid]["weak_topics"].update(row["weak_topics"].split(","))

    return [
        StudentPerformance(
            student_id=sid,
            student_name=data["name"],
            tests_taken=len(data["scores"]),
            average_score=round(sum(data["scores"]) / len(data["scores"]), 2),
            weak_topics=sorted(data["weak_topics"]),
        )
        for sid, data in by_student.items()
    ]
