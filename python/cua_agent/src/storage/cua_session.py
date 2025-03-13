import logging
import typing
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Literal

from openai.types.responses.response import Response
from openai.types.responses.response_computer_tool_call import (
    Action,
    PendingSafetyCheck,
)
from openai.types.responses.response_function_tool_call import (
    ResponseFunctionToolCall,
)

from cua.browser.browser import Browser

# Get logger for this module
logger = logging.getLogger(__name__)


@dataclass
class CuaSessionHistory:
    call_action: Action | ResponseFunctionToolCall | None = None
    pending_safety_checks: list[PendingSafetyCheck] = field(default_factory=list)
    last_message: str = ""


class CuaSessionStepState:
    "Tracking and controlling the state."

    response_id: str
    next_action: typing.Literal[
        "user_interaction", "computer_call_output", "functional_call"
    ]
    call_id: str = ""
    call_action: Action | ResponseFunctionToolCall | None = None
    pending_safety_checks: list[PendingSafetyCheck] = []
    last_message: str = ""
    response: Response
    screenshot_base64: str | None = None

    def __init__(self, response: Response, screenshot_base64: str | None = None):
        logger.debug("Initializing state with response: %s", response)
        assert response.status == "completed"
        self.response = response
        self.next_action = ""
        self.response_id = response.id
        self.screenshot_base64 = screenshot_base64
        # If the item is a computer call, setting the next action and passing the action arguments.
        for item in response.output:
            if item.type == "function_call":  # Add handling for function type
                self.next_action = "functional_call"
                self.call_id = item.call_id
                self.call_action = item
            elif item.type == "computer_call":
                self.next_action = "computer_call_output"
                # Ensure we always have a valid string ID
                self.call_id = item.call_id
                self.call_action = item.action
                self.pending_safety_checks = getattr(item, "pending_safety_checks", [])
            else:
                self.next_action = "user_interaction"
                if item.type == "message":
                    for content in item.content:
                        if content.type == "output_text":
                            self.last_message += content.text


class CuaSession:
    history: list[CuaSessionHistory]
    current_step: CuaSessionStepState | None
    id: str
    created_at: datetime
    signal: Literal["acknowledged_pending_safety_checks", "pause_requested"] | None
    browser: Browser | None

    def __init__(self):
        self.history = []
        self.current_step = None
        self.id = str(uuid.uuid4())
        self.created_at = datetime.now()
        self.signal = None
        self.browser = None

    def add_step(self, response: Response, screenshot_base64: str | None = None):
        step = CuaSessionStepState(response, screenshot_base64=screenshot_base64)
        self.history.append(
            CuaSessionHistory(
                call_action=step.call_action,
                pending_safety_checks=step.pending_safety_checks,
                last_message=step.last_message,
            )
        )
        self.current_step = step

    @classmethod
    def create(cls) -> "CuaSession":
        return cls()
