import secrets
import string
import bcrypt
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import List
from database import get_connection
from auth import require_admin

router = APIRouter()


class CreateStudentRequest(BaseModel):
    name: str
    semester: int = Field(ge=1, le=8)


class CreateStudentResponse(BaseModel):
    user_id: int
    name: str
    username: str
    semester: int
    temporary_password: str


class StudentSummary(BaseModel):
    user_id: int
    name: str
    username: str
    semester: int | None
    must_change_password: bool


class UpdateSemesterRequest(BaseModel):
    semester: int = Field(ge=1, le=8)


def generate_username(name: str, cursor) -> str:
    base = name.strip().split(" ")[0].lower() or "student"
    base = "".join(ch for ch in base if ch.isalnum()) or "student"

    for _ in range(20):
        candidate = f"{base}{secrets.randbelow(90) + 10}"
        cursor.execute("SELECT user_id FROM users WHERE username = %s", (candidate,))
        if cursor.fetchone() is None:
            return candidate

    raise HTTPException(status_code=500, detail="Could not generate a unique username, try again")


def generate_password(length: int = 8) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def hash_password(plain_password: str) -> str:
    return bcrypt.hashpw(plain_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


@router.post("/admin/students", response_model=CreateStudentResponse)
def create_student(request: CreateStudentRequest, admin_user: dict = Depends(require_admin)):
    conn = get_connection()
    cursor = conn.cursor()

    username = generate_username(request.name, cursor)
    temporary_password = generate_password()
    hashed_password = hash_password(temporary_password)

    cursor.execute(
        """
        INSERT INTO users
            (name, username, password_hash, role, must_change_password, semester)
        VALUES (%s, %s, %s, 'student', true, %s)
        RETURNING user_id;
        """,
        (request.name, username, hashed_password, request.semester),
    )
    new_id = cursor.fetchone()["user_id"]
    conn.commit()
    cursor.close()
    conn.close()

    return CreateStudentResponse(
        user_id=new_id,
        name=request.name,
        username=username,
        semester=request.semester,
        temporary_password=temporary_password,
    )


@router.get("/admin/students", response_model=List[StudentSummary])
def list_students(admin_user: dict = Depends(require_admin)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT user_id, name, username, semester, must_change_password
        FROM users
        WHERE role = 'student'
        ORDER BY semester NULLS LAST, user_id;
        """
    )
    students = cursor.fetchall()
    cursor.close()
    conn.close()
    return students


@router.patch("/admin/students/{user_id}/semester", response_model=StudentSummary)
def update_student_semester(
    user_id: int,
    request: UpdateSemesterRequest,
    admin_user: dict = Depends(require_admin),
):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        UPDATE users
        SET semester = %s
        WHERE user_id = %s AND role = 'student'
        RETURNING user_id, name, username, semester, must_change_password;
        """,
        (request.semester, user_id),
    )
    student = cursor.fetchone()

    if not student:
        cursor.close()
        conn.close()
        raise HTTPException(status_code=404, detail="Student not found")

    conn.commit()
    cursor.close()
    conn.close()
    return student
