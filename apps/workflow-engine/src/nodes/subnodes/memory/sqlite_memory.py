"""SQLite-backed persistent chat memory for AI agents."""

from __future__ import annotations

import sqlite3
import threading
from pathlib import Path
from typing import Any, TYPE_CHECKING

from ...base import (
    NodeProperty,
    NodeTypeDescription,
)
from ..base_subnode import BaseSubnode

if TYPE_CHECKING:
    from ....engine.types import NodeDefinition


# Thread-local connections (sqlite3 objects can't cross threads)
_local = threading.local()

# Use a dedicated DB file to avoid contention with the main workflows.db
_DB_PATH = Path(__file__).resolve().parents[4] / "agent_memory.db"


def _get_connection() -> sqlite3.Connection:
    """Get a thread-local SQLite connection with WAL mode."""
    conn = getattr(_local, "conn", None)
    if conn is None:
        conn = sqlite3.connect(str(_DB_PATH))
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA busy_timeout=5000")
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS chat_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_chat_session ON chat_messages(session_id)"
        )
        conn.commit()
        _local.conn = conn
    return conn


class SQLiteMemoryNode(BaseSubnode):
    """Persistent SQLite-backed chat memory that survives server restarts."""

    node_description = NodeTypeDescription(
        name="SQLiteMemory",
        display_name="SQLite Memory",
        description="Persistent chat history stored in SQLite",
        icon="fa:database",
        group=["ai"],
        inputs=[],
        outputs=[],
        properties=[
            NodeProperty(
                display_name="Session ID",
                name="sessionId",
                type="string",
                default="default",
                description="Unique session identifier for chat history. Supports expressions.",
            ),
            NodeProperty(
                display_name="Max Messages",
                name="maxMessages",
                type="number",
                default=50,
                description="Maximum messages to keep in history",
            ),
        ],
        is_subnode=True,
        subnode_type="memory",
        provides_to_slot="memory",
    )

    def get_config(self, node_definition: NodeDefinition) -> dict[str, Any]:
        """Return memory configuration with accessor functions."""
        session_id = self.get_parameter(node_definition, "sessionId", "default")
        max_messages = self.get_parameter(node_definition, "maxMessages", 50)

        return {
            "type": "sqlite",
            "sessionId": session_id,
            "maxMessages": max_messages,
            "getHistory": lambda: self._get_history(session_id, max_messages),
            "addMessage": lambda role, content: self._add_message(session_id, role, content, max_messages),
            "clearHistory": lambda: self._clear_history(session_id),
            "getHistoryText": lambda: self._get_history_text(session_id, max_messages),
        }

    @staticmethod
    def _get_history(session_id: str, max_messages: int) -> list[dict[str, str]]:
        """Get chat history for session."""
        conn = _get_connection()
        rows = conn.execute(
            "SELECT role, content FROM chat_messages WHERE session_id = ? ORDER BY id DESC LIMIT ?",
            (session_id, max_messages),
        ).fetchall()
        # Rows come back newest-first, reverse to chronological order
        return [{"role": r[0], "content": r[1]} for r in reversed(rows)]

    @staticmethod
    def _add_message(session_id: str, role: str, content: str, max_messages: int) -> None:
        """Add message and trim old entries beyond limit."""
        conn = _get_connection()
        conn.execute(
            "INSERT INTO chat_messages (session_id, role, content) VALUES (?, ?, ?)",
            (session_id, role, content),
        )
        # Trim: keep only the latest max_messages rows for this session
        conn.execute(
            """
            DELETE FROM chat_messages
            WHERE session_id = ? AND id NOT IN (
                SELECT id FROM chat_messages WHERE session_id = ? ORDER BY id DESC LIMIT ?
            )
            """,
            (session_id, session_id, max_messages),
        )
        conn.commit()

    @staticmethod
    def _clear_history(session_id: str) -> None:
        """Clear chat history for session."""
        conn = _get_connection()
        conn.execute("DELETE FROM chat_messages WHERE session_id = ?", (session_id,))
        conn.commit()

    @staticmethod
    def _get_history_text(session_id: str, max_messages: int) -> str:
        """Get chat history as formatted text for prompt injection."""
        history = SQLiteMemoryNode._get_history(session_id, max_messages)
        if not history:
            return ""
        lines = []
        for msg in history:
            role = "User" if msg["role"] == "user" else "Assistant"
            lines.append(f"{role}: {msg['content']}")
        return "\n".join(lines)
