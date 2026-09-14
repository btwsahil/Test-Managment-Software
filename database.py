import os
import pg8000.dbapi
from dotenv import load_dotenv

load_dotenv()

DB_CONFIG = {
    "user": os.getenv("DB_USER"),
    "password": os.getenv("DB_PASSWORD"),
    "host": os.getenv("DB_HOST"),
    "port": int(os.getenv("DB_PORT", 5432)),
    "database": os.getenv("DB_NAME"),
}


class DictCursor:
    """
    Wraps a pg8000 cursor so fetchone()/fetchall() return dictionaries
    (e.g. {"user_id": 1}) instead of plain tuples - matching how the
    rest of our code already expects to read query results.
    """
    def __init__(self, raw_cursor):
        self._cursor = raw_cursor

    def execute(self, *args, **kwargs):
        return self._cursor.execute(*args, **kwargs)

    def _row_to_dict(self, row):
        if row is None:
            return None
        columns = [desc[0] for desc in self._cursor.description]
        return dict(zip(columns, row))

    def fetchone(self):
        return self._row_to_dict(self._cursor.fetchone())

    def fetchall(self):
        return [self._row_to_dict(row) for row in self._cursor.fetchall()]

    def close(self):
        self._cursor.close()


class DictConnection:
    def __init__(self, raw_conn):
        self._conn = raw_conn

    def cursor(self):
        return DictCursor(self._conn.cursor())

    def commit(self):
        self._conn.commit()

    def close(self):
        self._conn.close()


def get_connection():
    """
    Opens a new connection to the PostgreSQL database using pg8000,
    a pure-Python driver. No compiled DLL is involved, so it can't be
    blocked by Windows Application Control / antivirus policies the
    way psycopg2's native extension was.
    """
    raw_conn = pg8000.dbapi.connect(**DB_CONFIG)
    return DictConnection(raw_conn)
