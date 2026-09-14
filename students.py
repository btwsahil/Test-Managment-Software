import secrets
import string
import bcrypt
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List
from database import get_connection
from auth import require_admin

router = APIRouter()


# ---------- Request/response shapes ----------
class CreateStudentRequest(BaseModel):
    name: str


class CreateStudentResponse(BaseModel):
    user_id: int
    name: str
    username: str
    temporary_password: str  # shown ONCE right after creation - never stored in plain text


class StudentSummary(BaseModel):
    user_id: int
    name: str
    username: str
    must_change_password: bool


# ---------- Helpers ----------
def generate_username(name: str, cursor) -> str:
    """
    Builds a username from the student's first name plus random digits,
    retrying until it finds one that doesn't already exist.
    e.g. 'Rahul Sharma' -> 'rahul47'
    """
    base = name.strip().split(" ")[0].lower() or "student"
    base = "".join(ch for ch in base if ch.isalnum()) or "student"

    for _ in range(20):  # 20 attempts is more than enough in practice
        candidate = f"{base}{secrets.randbelow(90) + 10}"  # e.g. rahul47
        cursor.execute("SELECT user_id FROM users WHERE username = %s", (candidate,))
        if cursor.fetchone() is None:
            return candidate

    raise HTTPException(status_code=500, detail="Could not generate a unique username, try again")


def generate_password(length: int = 8) -> str:
    """Generates a random temporary password using letters and digits."""
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def hash_password(plain_password: str) -> str:
    hashed = bcrypt.hashpw(plain_password.encode("utf-8"), bcrypt.gensalt())
    return hashed.decode("utf-8")


# ---------- Endpoints ----------
@router.post("/admin/students", response_model=CreateStudentResponse)
def create_student(request: CreateStudentRequest, admin_user: dict = Depends(require_admin)):
    """
    Admin provides just a name. We auto-generate a username and a temporary
    password, hash the password before storing, and return the PLAIN password
    ONCE in this response so the admin can note it down and give it to the
    student. must_change_password is set to true, forcing a reset on first login.
    """
    conn = get_connection()
    cursor = conn.cursor()

    username = generate_username(request.name, cursor)
    temporary_password = generate_password()
    hashed_password = hash_password(temporary_password)

    cursor.execute(
        """
        INSERT INTO users (name, username, password_hash, role, must_change_password)
        VALUES (%s, %s, %s, 'student', true)
        RETURNING user_id;
        """,
        (request.name, username, hashed_password),
    )
    new_id = cursor.fetchone()["user_id"]
    conn.commit()
    cursor.close()
    conn.close()

    return CreateStudentResponse(
        user_id=new_id,
        name=request.name,
        username=username,
        temporary_password=temporary_password,
    )


@router.get("/admin/students", response_model=List[StudentSummary])
def list_students(admin_user: dict = Depends(require_admin)):
    """Lists all student accounts (never returns password hashes)."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT user_id, name, username, must_change_password FROM users WHERE role = 'student' ORDER BY user_id;"
    )
    students = cursor.fetchall()
    cursor.close()
    conn.close()
    return students
