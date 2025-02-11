import uuid
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import List, Optional


class SessionState(Enum):
    STARTED = "started"
    DONE = "done"
    ERROR = "error"
    CANCELLATION_REQUESTED = "cancellation_requested"


@dataclass
class SessionStepState:
    screenshot: str
    action: str  # Current evaluation
    memory: Optional[str] = None
    next_goal: Optional[str] = None
    actions: List[str] = None  # List of planned actions


class Session:
    def __init__(self):
        self.session_state: list[SessionStepState] = []
        self.created_at: datetime = datetime.now()
        self.state: SessionState = SessionState.STARTED
        self.browser_agent = None
        self.id: str = str(uuid.uuid4())

    @classmethod
    def create(cls) -> "Session":
        return cls()
