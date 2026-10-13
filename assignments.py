from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List
from database import get_connection
from auth import require_admin

router = APIRouter()

MINUTES_PER_QUESTION = 1.5
MAX_BULK_STUDENTS = 85


class CreateAssignmentRequest(BaseModel):
    student_id: int
    subject_id: int
    topic_id: Optional[int] = None
    num_questions: int = Field(gt=0)
    time_limit_minutes: Optional[int] = Field(default=None, gt=0)
    easy_questions: int = Field(default=0, ge=0)
    medium_questions: int = Field(default=0, ge=0)
    hard_questions: int = Field(default=0, ge=0)


class BulkCreateAssignmentRequest(BaseModel):
    student_ids: List[int] = Field(min_length=1, max_length=MAX_BULK_STUDENTS)
    semester: int = Field(ge=1, le=8)
    subject_id: int
    topic_id: Optional[int] = None
    num_questions: int = Field(gt=0)
    time_limit_minutes: Optional[int] = Field(default=None, gt=0)
    easy_questions: int = Field(default=0, ge=0)
    medium_questions: int = Field(default=0, ge=0)
    hard_questions: int = Field(default=0, ge=0)


class AssignmentResponse(BaseModel):
    assignment_id: int
    student_id: int
    student_name: str
    subject_id: int
    subject_name: str
    topic_id: Optional[int]
    topic_name: Optional[str]
    num_questions: int
    time_limit_minutes: int
    status: str


def _validate_difficulty_counts(request):
    total = request.easy_questions + request.medium_questions + request.hard_questions
    if total not in (0, request.num_questions):
        raise HTTPException(
            status_code=400,
            detail="Easy + Medium + Hard must equal num_questions, or all three must be 0 for Mixed.",
        )


def _validate_test_config(cursor, request):
    _validate_difficulty_counts(request)

    cursor.execute(
        "SELECT subject_id, subject_name FROM subjects WHERE subject_id = %s",
        (request.subject_id,),
    )
    subject = cursor.fetchone()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")

    topic_name = None
    if request.topic_id is not None:
        cursor.execute(
            """
            SELECT topic_id, topic_name
            FROM topics
            WHERE topic_id = %s AND subject_id = %s
            """,
            (request.topic_id, request.subject_id),
        )
        topic = cursor.fetchone()
        if not topic:
            raise HTTPException(status_code=404, detail="Topic not found for this subject")
        topic_name = topic["topic_name"]

    where = "subject_id = %s"
    params = [request.subject_id]
    if request.topic_id is not None:
        where += " AND topic_id = %s"
        params.append(request.topic_id)

    if request.easy_questions + request.medium_questions + request.hard_questions == 0:
        cursor.execute(f"SELECT COUNT(*) AS count FROM questions WHERE {where}", tuple(params))
        available = cursor.fetchone()["count"]
        if available < request.num_questions:
            raise HTTPException(
                status_code=400,
                detail=f"Only {available} question(s) available, but {request.num_questions} requested.",
            )
    else:
        for difficulty, needed in [
            ("Easy", request.easy_questions),
            ("Medium", request.medium_questions),
            ("Hard", request.hard_questions),
        ]:
            if needed:
                cursor.execute(
                    f"SELECT COUNT(*) AS count FROM questions WHERE {where} AND difficulty = %s",
                    tuple(params + [difficulty]),
                )
                available = cursor.fetchone()["count"]
                if available < needed:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Only {available} {difficulty} question(s) available, but {needed} requested.",
                    )

    time_limit = request.time_limit_minutes
    if time_limit is None:
        time_limit = max(1, round(request.num_questions * MINUTES_PER_QUESTION))

    return subject, topic_name, time_limit


@router.post("/admin/assignments", response_model=AssignmentResponse)
def create_assignment(request: CreateAssignmentRequest, admin_user: dict = Depends(require_admin)):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT user_id, name FROM users WHERE user_id = %s AND role = 'student'",
        (request.student_id,),
    )
    student = cursor.fetchone()
    if not student:
        cursor.close()
        conn.close()
        raise HTTPException(status_code=404, detail="Student not found")

    try:
        subject, topic_name, time_limit = _validate_test_config(cursor, request)
        cursor.execute(
            """
            INSERT INTO assignments
                (student_id, subject_id, topic_id, num_questions,
                 time_limit_minutes, status, assigned_by,
                 easy_questions, medium_questions, hard_questions)
            VALUES (%s, %s, %s, %s, %s, 'pending', %s, %s, %s, %s)
            RETURNING assignment_id;
            """,
            (
                request.student_id, request.subject_id, request.topic_id,
                request.num_questions, time_limit, admin_user["sub"],
                request.easy_questions, request.medium_questions, request.hard_questions,
            ),
        )
        new_id = cursor.fetchone()["assignment_id"]
        conn.commit()
    except HTTPException:
        cursor.close()
        conn.close()
        raise
    except Exception:
        conn.rollback()
        cursor.close()
        conn.close()
        raise

    cursor.close()
    conn.close()

    return AssignmentResponse(
        assignment_id=new_id,
        student_id=request.student_id,
        student_name=student["name"],
        subject_id=request.subject_id,
        subject_name=subject["subject_name"],
        topic_id=request.topic_id,
        topic_name=topic_name,
        num_questions=request.num_questions,
        time_limit_minutes=time_limit,
        status="pending",
    )


@router.post("/admin/assignments/bulk")
def create_bulk_assignments(
    request: BulkCreateAssignmentRequest,
    admin_user: dict = Depends(require_admin),
):
    """
    Creates the SAME test configuration for every selected student in one
    semester. Maximum 85 students per request.
    """
    if len(set(request.student_ids)) != len(request.student_ids):
        raise HTTPException(status_code=400, detail="Duplicate student IDs were selected.")

    conn = get_connection()
    cursor = conn.cursor()

    try:
        placeholders = ",".join(["%s"] * len(request.student_ids))
        cursor.execute(
            f"""
            SELECT user_id, name, semester
            FROM users
            WHERE role = 'student'
              AND user_id IN ({placeholders})
            """,
            tuple(request.student_ids),
        )
        rows = cursor.fetchall()

        found = {row["user_id"]: row for row in rows}
        missing = [sid for sid in request.student_ids if sid not in found]
        if missing:
            raise HTTPException(
                status_code=404,
                detail=f"Student(s) not found: {missing}",
            )

        wrong_semester = [
            row["user_id"]
            for row in rows
            if row["semester"] != request.semester
        ]
        if wrong_semester:
            raise HTTPException(
                status_code=400,
                detail=f"Some selected students are not in semester {request.semester}: {wrong_semester}",
            )

        subject, topic_name, time_limit = _validate_test_config(cursor, request)

        assignment_ids = []
        for student_id in request.student_ids:
            cursor.execute(
                """
                INSERT INTO assignments
                    (student_id, subject_id, topic_id, num_questions,
                     time_limit_minutes, status, assigned_by,
                     easy_questions, medium_questions, hard_questions)
                VALUES (%s, %s, %s, %s, %s, 'pending', %s, %s, %s, %s)
                RETURNING assignment_id;
                """,
                (
                    student_id, request.subject_id, request.topic_id,
                    request.num_questions, time_limit, admin_user["sub"],
                    request.easy_questions, request.medium_questions, request.hard_questions,
                ),
            )
            assignment_ids.append(cursor.fetchone()["assignment_id"])

        conn.commit()

        return {
            "message": f"Test assigned to {len(assignment_ids)} student(s).",
            "semester": request.semester,
            "student_count": len(assignment_ids),
            "assignment_ids": assignment_ids,
            "subject_id": request.subject_id,
            "subject_name": subject["subject_name"],
            "topic_id": request.topic_id,
            "topic_name": topic_name,
            "num_questions": request.num_questions,
            "time_limit_minutes": time_limit,
        }

    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Bulk assignment failed: {e}")
    finally:
        cursor.close()
        conn.close()


@router.get("/admin/assignments", response_model=List[AssignmentResponse])
def list_assignments(admin_user: dict = Depends(require_admin)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT
            a.assignment_id, a.student_id, u.name as student_name,
            a.subject_id, s.subject_name, a.topic_id, t.topic_name,
            a.num_questions, a.time_limit_minutes, a.status
        FROM assignments a
        JOIN users u ON a.student_id = u.user_id
        JOIN subjects s ON a.subject_id = s.subject_id
        LEFT JOIN topics t ON a.topic_id = t.topic_id
        ORDER BY a.assignment_id DESC;
        """
    )
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return rows
