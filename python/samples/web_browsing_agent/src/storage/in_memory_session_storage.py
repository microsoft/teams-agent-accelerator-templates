from typing import Dict, Optional

from browser.session import Session


class InMemorySessionStorage:
    def __init__(self):
        self._sessions: Dict[str, Session] = {}

    def get_session(self, user_id: str) -> Optional[Session]:
        """Get a session for a user if it exists"""
        return self._sessions.get(user_id)

    def create_session(self, user_id: str) -> Session:
        """Create a new session for a user"""
        session = Session.create()
        self._sessions[user_id] = session
        return session

    def get_or_create_session(self, user_id: str) -> Session:
        """Get an existing session or create a new one if it doesn't exist"""
        session = self.get_session(user_id)
        if session is None:
            session = self.create_session(user_id)
        return session

    def delete_session(self, user_id: str) -> None:
        """Delete a user's session if it exists"""
        if user_id in self._sessions:
            del self._sessions[user_id]

    def clear(self) -> None:
        """Clear all sessions"""
        self._sessions.clear() 