import pandas as pd
from io import BytesIO
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from pydantic import BaseModel
from typing import List
from database import get_connection
from auth import require_admin

router = APIRouter()

REQUIRED_COLUMNS = [
    "subject", "topic", "question",
    "option_a", "option_b", "option_c", "option_d", "correct_option"
]


class ParsedQuestion(BaseModel):
    row_number: int
    subject: str
    topic: str
    question: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_option: str
    error: str | None = None  # filled in if this row has a problem


class PreviewResponse(BaseModel):
    total_rows: int
    valid_count: int
    error_count: int
    questions: List[ParsedQuestion]


def validate_row(row_number: int, row: dict) -> ParsedQuestion:
    """Checks one row for problems and returns it with an error message if invalid."""
    error = None

    # Check nothing important is empty
    for col in REQUIRED_COLUMNS:
        if pd.isna(row.get(col)) or str(row.get(col)).strip() == "":
            error = f"Missing value in '{col}'"
            break

    # Check correct_option is exactly A, B, C, or D
    correct = str(row.get("correct_option", "")).strip().upper()
    if not error and correct not in ["A", "B", "C", "D"]:
        error = f"correct_option must be A, B, C, or D (got '{row.get('correct_option')}')"

    return ParsedQuestion(
        row_number=row_number,
        subject=str(row.get("subject", "")).strip(),
        topic=str(row.get("topic", "")).strip(),
        question=str(row.get("question", "")).strip(),
        option_a=str(row.get("option_a", "")).strip(),
        option_b=str(row.get("option_b", "")).strip(),
        option_c=str(row.get("option_c", "")).strip(),
        option_d=str(row.get("option_d", "")).strip(),
        correct_option=correct,
        error=error,
    )


@router.post("/admin/questions/preview", response_model=PreviewResponse)
async def preview_questions(file: UploadFile = File(...), admin_user: dict = Depends(require_admin)):
    """
    Step 1: Admin uploads the Excel file. We parse it and return a preview
    WITHOUT saving anything yet, so the admin can review and catch mistakes.
    """
    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Please upload an Excel file (.xlsx or .xls)")

    contents = await file.read()
    try:
        df = pd.read_excel(BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read the Excel file: {e}")

    missing_columns = [col for col in REQUIRED_COLUMNS if col not in df.columns]
    if missing_columns:
        raise HTTPException(
            status_code=400,
            detail=f"Missing required columns: {', '.join(missing_columns)}"
        )

    parsed = [validate_row(i + 2, row.to_dict()) for i, row in df.iterrows()]  # +2: header row + 1-indexing
    valid_count = sum(1 for q in parsed if q.error is None)

    return PreviewResponse(
        total_rows=len(parsed),
        valid_count=valid_count,
        error_count=len(parsed) - valid_count,
        questions=parsed,
    )


@router.post("/admin/questions/confirm")
def confirm_questions(questions: List[ParsedQuestion], admin_user: dict = Depends(require_admin)):
    """
    Step 2: Admin has reviewed the preview and confirms. We insert only the
    VALID rows (error is None) into subjects, topics, and questions tables.
    """
    conn = get_connection()
    cursor = conn.cursor()
    inserted = 0
    skipped = 0

    for q in questions:
        if q.error:
            skipped += 1
            continue

        # Get or create the subject
        cursor.execute("SELECT subject_id FROM subjects WHERE subject_name = %s", (q.subject,))
        subject_row = cursor.fetchone()
        if subject_row:
            subject_id = subject_row["subject_id"]
        else:
            cursor.execute(
                "INSERT INTO subjects (subject_name) VALUES (%s) RETURNING subject_id", (q.subject,)
            )
            subject_id = cursor.fetchone()["subject_id"]

        # Get or create the topic (scoped to this subject)
        cursor.execute(
            "SELECT topic_id FROM topics WHERE subject_id = %s AND topic_name = %s",
            (subject_id, q.topic),
        )
        topic_row = cursor.fetchone()
        if topic_row:
            topic_id = topic_row["topic_id"]
        else:
            cursor.execute(
                "INSERT INTO topics (subject_id, topic_name) VALUES (%s, %s) RETURNING topic_id",
                (subject_id, q.topic),
            )
            topic_id = cursor.fetchone()["topic_id"]

        # Insert the question itself
        cursor.execute(
            """
            INSERT INTO questions
                (subject_id, topic_id, question_text, option_a, option_b, option_c, option_d, correct_option)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (subject_id, topic_id, q.question, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_option),
        )
        inserted += 1

    conn.commit()
    cursor.close()
    conn.close()

    return {"inserted": inserted, "skipped": skipped}
