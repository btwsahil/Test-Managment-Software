from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from database import get_connection
from auth import verify_password, create_access_token, get_current_user, require_admin
import bcrypt
from questions import router as questions_router
from students import router as students_router
from assignments import router as assignments_router
from student_test import router as student_test_router
from results import router as results_router
from student_portal import router as student_portal_router

app = FastAPI(title="Test Platform API")

app.include_router(questions_router)
app.include_router(students_router)
app.include_router(assignments_router)
app.include_router(student_test_router)
app.include_router(results_router)
app.include_router(student_portal_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    must_change_password: bool


class ChangePasswordRequest(BaseModel):
    new_password: str


@app.get("/")
def root():
    return {"message": "Test Platform API is running"}


@app.get("/test-db")
def test_db_connection():
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT subject_name FROM subjects;")
        subjects = cursor.fetchall()
        cursor.close()
        conn.close()
        return {"status": "connected", "subjects": subjects}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/login", response_model=LoginResponse)
def login(credentials: LoginRequest):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT user_id, username, password_hash, role, must_change_password FROM users WHERE username = %s",
        (credentials.username,),
    )
    user = cursor.fetchone()
    cursor.close()
    conn.close()

    if not user or not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    token = create_access_token(user["user_id"], user["username"], user["role"])

    return LoginResponse(
        access_token=token,
        role=user["role"],
        must_change_password=user["must_change_password"],
    )


@app.get("/admin/me")
def admin_only_test(admin_user: dict = Depends(require_admin)):
    return {"message": "You are logged in as an admin", "user": admin_user}


@app.post("/change-password")
def change_password(
    request: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user),
):
    if len(request.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    hashed = bcrypt.hashpw(
        request.new_password.encode("utf-8"),
        bcrypt.gensalt(),
    ).decode("utf-8")

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE users SET password_hash = %s, must_change_password = false WHERE user_id = %s",
        (hashed, current_user["sub"]),
    )
    conn.commit()
    cursor.close()
    conn.close()

    return {"status": "password updated"}
