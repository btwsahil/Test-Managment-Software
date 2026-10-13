import os
import bcrypt
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Literal
from database import get_connection

router = APIRouter()


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=6, max_length=128)
    role: Literal["student", "admin"]
    admin_key: str | None = None


class RegisterResponse(BaseModel):
    user_id: int
    name: str
    username: str
    role: str
    must_change_password: bool


@router.post("/register", response_model=RegisterResponse)
def register(request: RegisterRequest):
    """
    Public account creation from the login page.
    Student accounts can be created normally.
    Admin accounts additionally require ADMIN_SIGNUP_KEY from the backend .env.
    """
    name = request.name.strip()
    username = request.username.strip().lower()

    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    if not username:
        raise HTTPException(status_code=400, detail="Username is required")
    if len(request.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    if request.role == "admin":
        signup_key = os.getenv("ADMIN_SIGNUP_KEY")
        if not signup_key:
            raise HTTPException(
                status_code=403,
                detail="Admin self-registration is disabled. Configure ADMIN_SIGNUP_KEY on the server."
            )
        if request.admin_key != signup_key:
            raise HTTPException(status_code=403, detail="Invalid admin registration key")

    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT user_id FROM users WHERE username = %s", (username,))
        if cursor.fetchone():
            raise HTTPException(status_code=409, detail="Username already exists")

        hashed = bcrypt.hashpw(
            request.password.encode("utf-8"), bcrypt.gensalt()
        ).decode("utf-8")

        cursor.execute(
            """
            INSERT INTO users (name, username, password_hash, role, must_change_password)
            VALUES (%s, %s, %s, %s, true)
            RETURNING user_id, name, username, role, must_change_password;
            """,
            (name, username, hashed, request.role),
        )
        row = cursor.fetchone()
        conn.commit()
        return RegisterResponse(**row)
    except HTTPException:
        conn.rollback()
        raise
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()
