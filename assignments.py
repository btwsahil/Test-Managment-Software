from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from database import get_connection
from auth import require_admin

router = APIRouter()


# ---------- Request/response shapes ----------
class CreateAssignmentRequest(BaseModel):
    student_id: int
    subject_id: int
    topic_id: Optional[int] = None  # None = mixed topics across the whole subject
    num_questions: int
    time_limit_minutes: Optional[int] = None  # if not given, we auto-calculate


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


MINUTES_PER_QUESTION = 1.5  # used only when admin doesn't specify a time limit


@router.post("/admin/assignments", response_model=AssignmentResponse)
def create_assignment(request: CreateAssignmentRequest, admin_user: dict = Depends(require_admin)):
    """
    Admin assigns a test to a student: picks the student, subject, optionally
    a specific topic, how many questions, and a time limit. If no time limit
    is given, we calculate one automatically based on question count.
    """
    if request.num_questions <= 0:
        raise HTTPException(status_code=400, detail="num_questions must be greater than 0")

    conn = get_connection()
    cursor = conn.cursor()

    # Validate the student exists and is actually a student
    cursor.execute("SELECT user_id, name FROM users WHERE user_id = %s AND role = 'student'", (request.student_id,))
    student = cursor.fetchone()
    if not student:
        cursor.close()
        conn.close()
        raise HTTPException(status_code=404, detail="Student not found")

    # Validate the subject exists
    cursor.execute("SELECT subject_id, subject_name FROM subjects WHERE subject_id = %s", (request.subject_id,))
    subject = cursor.fetchone()
    if not subject:
        cursor.close()
        conn.close()
        raise HTTPException(status_code=404, detail="Subject not found")

    # If a topic was specified, validate it exists AND belongs to this subject
    topic_name = None
    if request.topic_id is not None:
        cursor.execute(
            "SELECT topic_id, topic_name FROM topics WHERE topic_id = %s AND subject_id = %s",
            (request.topic_id, request.subject_id),
        )
        topic = cursor.fetchone()
        if not topic:
            cursor.close()
            conn.close()
            raise HTTPException(status_code=404, detail="Topic not found for this subject")
        topic_name = topic["topic_name"]

    # Check there are ENOUGH questions available to actually fulfill this assignment
    if request.topic_id is not None:
        cursor.execute(
            "SELECT COUNT(*) as count FROM questions WHERE subject_id = %s AND topic_id = %s",
            (request.subject_id, request.topic_id),
        )
    else:
        cursor.execute(
            "SELECT COUNT(*) as count FROM questions WHERE subject_id = %s",
            (request.subject_id,),
        )
    available = cursor.fetchone()["count"]
    if available < request.num_questions:
        cursor.close()
        conn.close()
        raise HTTPException(
            status_code=400,
            detail=f"Only {available} question(s) available for this subject/topic, but {request.num_questions} were requested",
        )

    # Calculate a time limit automatically if the admin didn't set one
    time_limit = request.time_limit_minutes
    if time_limit is None:
        time_limit = max(1, round(request.num_questions * MINUTES_PER_QUESTION))

    cursor.execute(
        """
        INSERT INTO assignments
            (student_id, subject_id, topic_id, num_questions, time_limit_minutes, status, assigned_by)
        VALUES (%s, %s, %s, %s, %s, 'pending', %s)
        RETURNING assignment_id;
        """,
        (request.student_id, request.subject_id, request.topic_id,
         request.num_questions, time_limit, admin_user["sub"]),
    )
    new_id = cursor.fetchone()["assignment_id"]
    conn.commit()
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


@router.get("/admin/assignments", response_model=List[AssignmentResponse])
def list_assignments(admin_user: dict = Depends(require_admin)):
    """Lists all test assignments across all students, most recent first."""
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
