import base64
import logging

from cua.client import setup_openai_client
from cua.cua_target import CUATarget
from storage.cua_session import CuaSession

# Get logger for this module
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)


class ComputerUse:
    """ComputerUse loop to start and continue task execution"""

    def __init__(self, target: CUATarget, session: CuaSession):
        self.target = target
        self.session = session
        self.client, self.model = setup_openai_client()
        self.step_count = 0

    def _build_computer_use_tool(self):
        return {
            "type": "computer-preview",
            "display_width": self.target.width,
            "display_height": self.target.height,
            "environment": self.target.environment,
        }

    async def start_task(self, user_message: str):
        logger.info("Starting task...")
        tools = [self._build_computer_use_tool()]
        response = await self.client.responses.create(
            model=self.model, input=user_message, tools=tools, truncation="auto"
        )
        logger.debug("Response received: %s", response)
        self.session.add_step(response, None)
        self.step_count = 0
        logger.info("Task initialization completed")

    def requires_user_input(self):
        return self.session.current_step.next_action == "user_interaction"

    def requires_safety_check(self):
        return self.session.current_step.pending_safety_checks

    async def continue_task(self, user_message=""):
        self.step_count += 1
        logger.debug("\n---- Step %s ----", self.step_count)
        screenshot: str | None = None
        previous_response_id = self.session.current_step.response_id
        screenshot_base64: str | None = None
        if self.session.current_step.next_action == "computer_call_output":
            action = self.session.current_step.computer_action
            screenshot = await self.target.handle_tool_call(action)
            if not screenshot:
                screenshot = await self.target.take_screenshot()
            screenshot_base64 = base64.b64encode(screenshot).decode("utf-8")
            logger.debug("screenshot %s...", screenshot_base64[:20])
            # Store the screenshot in the session
            self.session.current_step.screenshot = screenshot_base64
        data = user_message
        if self.session.current_step.next_action == "computer_call_output":
            data = [
                {
                    "type": "computer_call_output",
                    "call_id": self.session.current_step.computer_id,
                    "output": {
                        "type": "input_image",
                        "image_url": f"data:image/png;base64,{screenshot_base64}",
                    },
                }
            ]
            if self.session.current_step.pending_safety_checks:
                data["acknowledged_safety_checks"] = (
                    self.session.current_step.pending_safety_checks
                )
        tools = [self._build_computer_use_tool()]
        logger.debug("Creating next response...")
        next_response = await self.client.responses.create(
            model=self.model,
            previous_response_id=previous_response_id,
            input=data,
            tools=tools,
            timeout=10,
            truncation="auto",
        )
        logger.debug("Next response created: %s", next_response)
        self.session.add_step(next_response, screenshot_base64)
