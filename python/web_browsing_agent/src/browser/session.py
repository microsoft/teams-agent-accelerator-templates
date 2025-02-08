from dataclasses import dataclass
from typing import List, Optional


@dataclass
class SessionStepState:
    screenshot: str
    action: str  # Current evaluation
    memory: Optional[str] = None
    next_goal: Optional[str] = None
    actions: List[str] = None  # List of planned actions


class Session:
    session_state: list[SessionStepState] = []

    @classmethod
    def create(cls) -> "Session":
        return cls()
