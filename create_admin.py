"""
Run this ONCE to create your first admin account.
Usage: python create_admin.py
"""

import bcrypt
from database import get_connection

# ---- EDIT THESE THREE VALUES ----
ADMIN_NAME = "admin"
ADMIN_USERNAME = "admin123"
ADMIN_PASSWORD = "tiger"
# ----------------------------------


def hash_password(plain_password: str) -> str:
    """Hashes a password using bcrypt directly (no passlib)."""
    hashed = bcrypt.hashpw(plain_password.encode("utf-8"), bcrypt.gensalt())
    return hashed.decode("utf-8")  # store as a string in the database


def create_admin():
    hashed_password = hash_password(ADMIN_PASSWORD)

    conn = get_connection()
    cursor = conn.cursor()

    # Prevent creating a duplicate if you accidentally run this twice
    cursor.execute("SELECT user_id FROM users WHERE username = %s", (ADMIN_USERNAME,))
    existing = cursor.fetchone()
    if existing:
        print(f"A user with username '{ADMIN_USERNAME}' already exists. Nothing was created.")
        cursor.close()
        conn.close()
        return

    cursor.execute(
        """
        INSERT INTO users (name, username, password_hash, role, must_change_password)
        VALUES (%s, %s, %s, 'admin', false)
        RETURNING user_id;
        """,
        (ADMIN_NAME, ADMIN_USERNAME, hashed_password),
    )
    new_id = cursor.fetchone()
    conn.commit()
    cursor.close()
    conn.close()

    print(f"Admin user created successfully. user_id = {new_id['user_id']}")
    print(f"Login with username='{ADMIN_USERNAME}' and the password you set in this script.")


if __name__ == "__main__":
    create_admin()
