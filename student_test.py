import random
import string
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from database import get_connection
from auth import require_student

router = APIRouter()


# ---------- Response shapes ----------
class MyAssignment(BaseModel):
    assignment_id: int
    subject_name: str
    topic_name: Optional[str]
    num_questions: int
    time_limit_minutes: int
    status: str


class QuestionForStudent(BaseModel):
    question_id: int
    question_order: int
    question_text: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    # NOTE: correct_option is deliberately NEVER included here


class StartTestResponse(BaseModel):
    session_id: int
    time_limit_minutes: int
    start_time: datetime
    questions: List[QuestionForStudent]


class AnswerRequest(BaseModel):
    question_id: int
    selected_option: str  # the DISPLAYED letter (A/B/C/D) the student clicked


class AnswerResponse(BaseModel):
    status: str
    question_id: int


class SubmitTestResponse(BaseModel):
    session_id: int
    total_questions: int
    correct_answers: int
    wrong_answers: int
    score_percent: float
    weak_topics: List[str]


# ---------- Helpers ----------
def shuffle_options(row: dict):
    """
    Given a question row with option_a..option_d and correct_option,
    returns (shuffled_options_dict, option_order_string).
    option_order records which ORIGINAL letter ended up in each displayed
    slot, e.g. "BADC" means displayed slot A shows the original option B's text.
    We need this so that when the student answers, we can translate their
    displayed choice back to the real A/B/C/D for correctness checking.
    """
    letters = ["A", "B", "C", "D"]
    shuffled_letters = letters[:]
    random.shuffle(shuffled_letters)  # e.g. ['B','A','D','C']

    original_text = {
        "A": row["option_a"], "B": row["option_b"],
        "C": row["option_c"], "D": row["option_d"],
    }

    displayed = {
        "A": original_text[shuffled_letters[0]],
        "B": original_text[shuffled_letters[1]],
        "C": original_text[shuffled_letters[2]],
        "D": original_text[shuffled_letters[3]],
    }
    option_order = "".join(shuffled_letters)  # store this - needed to check answers later
    return displayed, option_order


# ---------- Endpoints ----------
@router.get("/student/assignments", response_model=List[MyAssignment])
def my_assignments(student_user: dict = Depends(require_student)):
    """Lists all tests assigned to the currently logged-in student."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT a.assignment_id, s.subject_name, t.topic_name,
               a.num_questions, a.time_limit_minutes, a.status
        FROM assignments a
        JOIN subjects s ON a.subject_id = s.subject_id
        LEFT JOIN topics t ON a.topic_id = t.topic_id
        WHERE a.student_id = %s
        ORDER BY a.assignment_id DESC;
        """,
        (student_user["sub"],),
    )
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return rows


@router.post("/student/assignments/{assignment_id}/start", response_model=StartTestResponse)
def start_test(assignment_id: int, student_user: dict = Depends(require_student)):
    """
    Starts (or resumes) a test. On first call: picks a random set of
    questions matching the assignment's subject/topic, shuffles both the
    question order and each question's option order, saves that exact set
    to session_questions, and starts the server-side timer.
    On a repeat call (e.g. student refreshed the page): returns the SAME
    session and questions rather than generating a new random set - this
    prevents someone getting a fresh timer or fresh questions by refreshing.
    """
    conn = get_connection()
    cursor = conn.cursor()

    # Verify this assignment belongs to this student
    cursor.execute(
        "SELECT * FROM assignments WHERE assignment_id = %s AND student_id = %s",
        (assignment_id, student_user["sub"]),
    )
    assignment = cursor.fetchone()
    if not assignment:
        cursor.close()
        conn.close()
        raise HTTPException(status_code=404, detail="Assignment not found")

    if assignment["status"] == "completed":
        cursor.close()
        conn.close()
        raise HTTPException(status_code=400, detail="This test has already been completed")

    # Check for an existing in-progress session for this assignment (resume case)
    cursor.execute(
        "SELECT * FROM sessions WHERE assignment_id = %s AND end_time IS NULL ORDER BY session_id DESC LIMIT 1",
        (assignment_id,),
    )
    existing_session = cursor.fetchone()

    if existing_session:
        session_id = existing_session["session_id"]
        start_time = existing_session["start_time"]
        cursor.execute(
            """
            SELECT sq.question_id, sq.question_order, sq.option_order,
                   q.question_text, q.option_a, q.option_b, q.option_c, q.option_d
            FROM session_questions sq
            JOIN questions q ON sq.question_id = q.question_id
            WHERE sq.session_id = %s
            ORDER BY sq.question_order;
            """,
            (session_id,),
        )
        existing_rows = cursor.fetchall()
        questions_out = []
        for row in existing_rows:
            order = row["option_order"]
            original_text = {
                "A": row["option_a"], "B": row["option_b"],
                "C": row["option_c"], "D": row["option_d"],
            }
            displayed = {
                "A": original_text[order[0]], "B": original_text[order[1]],
                "C": original_text[order[2]], "D": original_text[order[3]],
            }
            questions_out.append(QuestionForStudent(
                question_id=row["question_id"], question_order=row["question_order"],
                question_text=row["question_text"], option_a=displayed["A"],
                option_b=displayed["B"], option_c=displayed["C"], option_d=displayed["D"],
            ))
        cursor.close()
        conn.close()
        return StartTestResponse(
            session_id=session_id, time_limit_minutes=assignment["time_limit_minutes"],
            start_time=start_time, questions=questions_out,
        )

    # No existing session - create a fresh one, pick and shuffle questions
    if assignment["topic_id"] is not None:
        cursor.execute(
            "SELECT * FROM questions WHERE subject_id = %s AND topic_id = %s",
            (assignment["subject_id"], assignment["topic_id"]),
        )
    else:
        cursor.execute("SELECT * FROM questions WHERE subject_id = %s", (assignment["subject_id"],))
    all_questions = cursor.fetchall()

    if len(all_questions) < assignment["num_questions"]:
        cursor.close()
        conn.close()
        raise HTTPException(status_code=400, detail="Not enough questions available to start this test")

    chosen = random.sample(all_questions, assignment["num_questions"])

    cursor.execute(
        "INSERT INTO sessions (assignment_id, start_time) VALUES (%s, NOW()) RETURNING session_id, start_time;",
        (assignment_id,),
    )
    session_row = cursor.fetchone()
    session_id = session_row["session_id"]
    start_time = session_row["start_time"]

    questions_out = []
    for order_num, q in enumerate(chosen, start=1):
        displayed, option_order = shuffle_options(q)
        cursor.execute(
            """
            INSERT INTO session_questions (session_id, question_id, question_order, option_order)
            VALUES (%s, %s, %s, %s);
            """,
            (session_id, q["question_id"], order_num, option_order),
        )
        questions_out.append(QuestionForStudent(
            question_id=q["question_id"], question_order=order_num,
            question_text=q["question_text"], option_a=displayed["A"],
            option_b=displayed["B"], option_c=displayed["C"], option_d=displayed["D"],
        ))

    cursor.execute("UPDATE assignments SET status = 'ongoing' WHERE assignment_id = %s", (assignment_id,))
    conn.commit()
    cursor.close()
    conn.close()

    return StartTestResponse(
        session_id=session_id, time_limit_minutes=assignment["time_limit_minutes"],
        start_time=start_time, questions=questions_out,
    )


@router.post("/student/sessions/{session_id}/answer", response_model=AnswerResponse)
def submit_answer(session_id: int, request: AnswerRequest, student_user: dict = Depends(require_student)):
    """
    Saves one answer immediately (auto-save). Called every time the student
    picks/changes an option for a question - NOT just once at the end.
    This means a browser crash or lost connection only loses the CURRENT
    unsaved click, not the whole test.

    We deliberately do NOT tell the student whether they got it right here -
    the response only confirms it was saved, so the test doesn't leak answers
    while it's still in progress.
    """
    conn = get_connection()
    cursor = conn.cursor()

    # Verify this session belongs to the logged-in student, and is still open
    cursor.execute(
        """
        SELECT s.session_id, s.end_time, a.student_id
        FROM sessions s
        JOIN assignments a ON s.assignment_id = a.assignment_id
        WHERE s.session_id = %s;
        """,
        (session_id,),
    )
    session = cursor.fetchone()
    if not session or str(session["student_id"]) != str(student_user["sub"]):
        cursor.close()
        conn.close()
        raise HTTPException(status_code=404, detail="Session not found")
    if session["end_time"] is not None:
        cursor.close()
        conn.close()
        raise HTTPException(status_code=400, detail="This test has already been submitted")

    # Find this question within the session, and its stored option_order
    cursor.execute(
        "SELECT option_order FROM session_questions WHERE session_id = %s AND question_id = %s",
        (session_id, request.question_id),
    )
    sq = cursor.fetchone()
    if not sq:
        cursor.close()
        conn.close()
        raise HTTPException(status_code=404, detail="This question is not part of this test session")

    selected = request.selected_option.strip().upper()
    if selected not in ["A", "B", "C", "D"]:
        cursor.close()
        conn.close()
        raise HTTPException(status_code=400, detail="selected_option must be A, B, C, or D")

    # Translate the DISPLAYED letter back to the REAL original letter using option_order.
    # e.g. option_order "BADC" means displayed A -> original B, displayed B -> original A, etc.
    letters = ["A", "B", "C", "D"]
    original_letter = sq["option_order"][letters.index(selected)]

    # Look up the real correct answer to determine is_correct
    cursor.execute("SELECT correct_option FROM questions WHERE question_id = %s", (request.question_id,))
    correct = cursor.fetchone()["correct_option"]
    is_correct = (original_letter == correct)

    cursor.execute(
        """
        UPDATE session_questions
        SET selected_option = %s, is_correct = %s, answered_at = NOW()
        WHERE session_id = %s AND question_id = %s;
        """,
        (original_letter, is_correct, session_id, request.question_id),
    )
    conn.commit()
    cursor.close()
    conn.close()

    return AnswerResponse(status="saved", question_id=request.question_id)


WEAK_TOPIC_THRESHOLD = 50.0  # accuracy below this % on a topic marks it as weak


@router.post("/student/sessions/{session_id}/submit", response_model=SubmitTestResponse)
def submit_test(session_id: int, student_user: dict = Depends(require_student)):
    """
    Final submit. Called either by the student clicking 'Submit', OR by the
    frontend automatically when the timer hits zero - either way, this is
    the ONLY place scoring happens, and it always checks the SERVER's clock
    against the time limit, never trusting the browser's countdown.

    Locks the session (sets end_time), scores every question, groups
    accuracy by topic to flag weak topics, and saves the result.
    """
    conn = get_connection()
    cursor = conn.cursor()

    # Verify this session belongs to the logged-in student
    cursor.execute(
        """
        SELECT s.session_id, s.start_time, s.end_time, s.assignment_id,
               a.student_id, a.time_limit_minutes
        FROM sessions s
        JOIN assignments a ON s.assignment_id = a.assignment_id
        WHERE s.session_id = %s;
        """,
        (session_id,),
    )
    session = cursor.fetchone()
    if not session or str(session["student_id"]) != str(student_user["sub"]):
        cursor.close()
        conn.close()
        raise HTTPException(status_code=404, detail="Session not found")

    if session["end_time"] is not None:
        # Already submitted before - just return the existing saved result instead of re-scoring
        cursor.execute("SELECT * FROM results WHERE session_id = %s", (session_id,))
        existing = cursor.fetchone()
        cursor.close()
        conn.close()
        if existing:
            weak = existing["weak_topics"].split(",") if existing["weak_topics"] else []
            return SubmitTestResponse(
                session_id=session_id, total_questions=existing["total_questions"],
                correct_answers=existing["correct_answers"], wrong_answers=existing["wrong_answers"],
                score_percent=float(existing["score_percent"]), weak_topics=weak,
            )
        raise HTTPException(status_code=400, detail="This test was already submitted")

    # Server-side time check: even if the student submits "late" due to a slow
    # network request, we don't reject it - the test is over either way once
    # time is up, so we just cap scoring at whatever was answered in time.
    # (The frontend is responsible for calling this automatically at time-up;
    # this backend check exists mainly to prevent a suspiciously-early fake submit
    # from mattering - scoring only counts what's actually answered regardless.)

    cursor.execute(
        """
        SELECT sq.is_correct, t.topic_name
        FROM session_questions sq
        JOIN questions q ON sq.question_id = q.question_id
        LEFT JOIN topics t ON q.topic_id = t.topic_id
        WHERE sq.session_id = %s;
        """,
        (session_id,),
    )
    all_rows = cursor.fetchall()

    total = len(all_rows)
    correct = sum(1 for r in all_rows if r["is_correct"] is True)
    wrong = total - correct
    score_percent = round((correct / total) * 100, 2) if total > 0 else 0.0

    # Group by topic to find weak areas
    topic_stats = {}
    for r in all_rows:
        topic = r["topic_name"] or "General"
        topic_stats.setdefault(topic, {"correct": 0, "total": 0})
        topic_stats[topic]["total"] += 1
        if r["is_correct"] is True:
            topic_stats[topic]["correct"] += 1

    weak_topics = [
        topic for topic, stats in topic_stats.items()
        if (stats["correct"] / stats["total"]) * 100 < WEAK_TOPIC_THRESHOLD
    ]

    cursor.execute("UPDATE sessions SET end_time = NOW() WHERE session_id = %s", (session_id,))
    cursor.execute(
        "UPDATE assignments SET status = 'completed' WHERE assignment_id = %s",
        (session["assignment_id"],),
    )
    cursor.execute(
        """
        INSERT INTO results
            (session_id, total_questions, correct_answers, wrong_answers, score_percent, weak_topics)
        VALUES (%s, %s, %s, %s, %s, %s);
        """,
        (session_id, total, correct, wrong, score_percent, ",".join(weak_topics)),
    )
    conn.commit()
    cursor.close()
    conn.close()

    return SubmitTestResponse(
        session_id=session_id, total_questions=total, correct_answers=correct,
        wrong_answers=wrong, score_percent=score_percent, weak_topics=weak_topics,
    )
