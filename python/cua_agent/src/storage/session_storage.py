from storage.browser_use_session import BrowserUseSession


class SessionStorage:
    """A simple in-memory storage for browser sessions."""

    def __init__(self):
        self._sessions = {}

    async def get_session(self, user_id: str) -> BrowserUseSession | None:
        """Get a session for a user if it exists."""
        return self._sessions.get(user_id)

    async def set_session(self, user_id: str, session: BrowserUseSession) -> None:
        """Store a session for a user."""
        self._sessions[user_id] = session

    async def delete_session(self, user_id: str) -> None:
        """Delete a user's session if it exists."""
        if user_id in self._sessions:
            del self._sessions[user_id]
