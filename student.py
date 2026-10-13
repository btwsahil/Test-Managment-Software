from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from database import get_connection
from auth import require_student

router = APIRouter()


class StudentProfile(BaseModel):
    user_id: int
    name: str
    username: str
    role: str


class StudentResult(BaseModel):
    result_id: int
    subject_name: str
    topic_name: Optional[str]
    total_questions: int
    correct_answers: int
    wrong_answers: int
    score_percent: float
    weak_topics: List[str]


@router.get("/student/me", response_model=StudentProfile)
def student_me(student_user: dict = Depends(require_student)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT user_id, name, username, role FROM users WHERE user_id = %s AND role = 'student'",
        (student_user["sub"],),
    )
    row = cursor.fetchone()
    cursor.close()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Student profile not found")

    return row


@router.get("/student/results", response_model=List[StudentResult])
def student_results(student_user: dict = Depends(require_student)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT
            r.result_id,
            s.subject_name,
            t.topic_name,
            r.total_questions,
            r.correct_answers,
            r.wrong_answers,
            r.score_percent,
            r.weak_topics
        FROM results r
        JOIN sessions se ON r.session_id = se.session_id
        JOIN assignments a ON se.assignment_id = a.assignment_id
        JOIN subjects s ON a.subject_id = s.subject_id
        LEFT JOIN topics t ON a.topic_id = t.topic_id
        WHERE a.student_id = %s
        ORDER BY r.result_id DESC;
        """,
        (student_user["sub"],),
    )
    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    return [
        StudentResult(
            result_id=row["result_id"],
            subject_name=row["subject_name"],
            topic_name=row["topic_name"],
            total_questions=row["total_questions"],
            correct_answers=row["correct_answers"],
            wrong_answers=row["wrong_answers"],
            score_percent=float(row["score_percent"]),
            weak_topics=row["weak_topics"].split(",") if row["weak_topics"] else [],
        )
        for row in rows
    ]
