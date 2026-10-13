from fastapi import APIRouter, Depends, HTTPException
from database import get_connection
from auth import require_student

router = APIRouter()


@router.get('/student/dashboard')
def student_dashboard(student_user: dict = Depends(require_student)):
    """Student dashboard data. Returns 200 even when the student has no tests/results."""
    student_id = student_user['sub']
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT user_id, name, username FROM users WHERE user_id = %s AND role = 'student'",
        (student_id,),
    )
    student = cursor.fetchone()
    if not student:
        cursor.close(); conn.close()
        raise HTTPException(status_code=404, detail='Student not found')

    cursor.execute(
        """
        SELECT assignment_id, status
        FROM assignments
        WHERE student_id = %s
        ORDER BY assignment_id DESC
        """,
        (student_id,),
    )
    assignments = cursor.fetchall()

    cursor.execute(
        """
        SELECT COUNT(*) AS completed_tests,
               COALESCE(AVG(r.score_percent), 0) AS average_score
        FROM results r
        JOIN sessions se ON r.session_id = se.session_id
        JOIN assignments a ON se.assignment_id = a.assignment_id
        WHERE a.student_id = %s
        """,
        (student_id,),
    )
    stats = cursor.fetchone()

    cursor.execute(
        """
        SELECT a.assignment_id, s.subject_name, t.topic_name,
               a.num_questions, a.time_limit_minutes, a.status
        FROM assignments a
        JOIN subjects s ON a.subject_id = s.subject_id
        LEFT JOIN topics t ON a.topic_id = t.topic_id
        WHERE a.student_id = %s
          AND a.status <> 'completed'
        ORDER BY a.assignment_id DESC
        LIMIT 5
        """,
        (student_id,),
    )
    assigned_tests = cursor.fetchall()

    cursor.close(); conn.close()

    available_tests = sum(1 for a in assignments if a['status'] in ('pending', 'ongoing'))
    completed_tests = int(stats['completed_tests'] or 0)
    average_score = float(stats['average_score'] or 0)

    # Include common camelCase and snake_case names so existing frontend versions
    # can consume the same endpoint without another backend change.
    return {
        'student': student,
        'name': student['name'],
        'availableTests': available_tests,
        'available_tests': available_tests,
        'completedTests': completed_tests,
        'completed_tests': completed_tests,
        'averageScore': average_score,
        'average_score': average_score,
        'assignedTests': assigned_tests,
        'assigned_tests': assigned_tests,
    }


@router.get('/student/results')
def student_results(student_user: dict = Depends(require_student)):
    """All results for the logged-in student. Empty list is a valid response."""
    student_id = student_user['sub']
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT r.result_id, a.assignment_id,
               s.subject_name, t.topic_name,
               r.total_questions, r.correct_answers, r.wrong_answers,
               r.score_percent, r.weak_topics
        FROM results r
        JOIN sessions se ON r.session_id = se.session_id
        JOIN assignments a ON se.assignment_id = a.assignment_id
        JOIN subjects s ON a.subject_id = s.subject_id
        LEFT JOIN topics t ON a.topic_id = t.topic_id
        WHERE a.student_id = %s
        ORDER BY r.result_id DESC
        """,
        (student_id,),
    )
    rows = cursor.fetchall()
    cursor.close(); conn.close()

    results = []
    for row in rows:
        results.append({
            **row,
            'score_percent': float(row['score_percent']),
            'weak_topics': row['weak_topics'].split(',') if row['weak_topics'] else [],
        })

    # Return both a plain list and a named property for compatibility with
    # frontend implementations that use either response.data or response.data.results.
    return results


@router.get('/student/profile')
def student_profile(student_user: dict = Depends(require_student)):
    """Basic profile information for the logged-in student."""
    student_id = student_user['sub']
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT user_id, name, username, role, must_change_password
        FROM users
        WHERE user_id = %s AND role = 'student'
        """,
        (student_id,),
    )
    student = cursor.fetchone()
    cursor.close(); conn.close()

    if not student:
        raise HTTPException(status_code=404, detail='Student not found')
    return student
