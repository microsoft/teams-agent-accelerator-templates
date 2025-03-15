import asyncio
import logging
import signal
import traceback

from botbuilder.core import TurnContext
from botbuilder.schema import Activity, ActivityTypes, Attachment, AttachmentLayoutTypes
from openai.types.responses.response_function_tool_call import (
    ResponseFunctionToolCall,
)

from cards import (
    ProgressStepDict,
    create_cua_progress_card,
    create_error_card,
    create_safety_check_card,
)
from config import Config
from cua.browser.browser import Browser
from cua.computer_use import ComputerUse
from cua.cua_target import CUATarget
from cua.scaled_cua_target import ScaledCUATarget
from cua.vnc.machine import Machine
from storage.cua_session import CuaSession

logger = logging.getLogger(__name__)


class ComputerUseAgent:
    def __init__(
        self, context: TurnContext, session: CuaSession, activity_id: str | None
    ):
        self._context = context
        self._session = session
        self._activity_id = activity_id

    async def run(self, task: str):
        def signal_handler():
            raise KeyboardInterrupt()

        # Register signal handler for clean interrupt
        loop = asyncio.get_running_loop()
        loop.add_signal_handler(signal.SIGINT, signal_handler)

        try:
            cua_target = await self._build_cua_target()
            agent = ComputerUse(cua_target, self._session)

            user_message = task
            if self._session.current_step or self._session.status in (
                "Paused",
                "Error",
            ):
                if agent.requires_safety_check():
                    if self._session.signal == "acknowledged_pending_safety_checks":
                        # Clear the signal and continue
                        self._session.signal = None
                    else:
                        # Send safety check card
                        await self._context.send_activity(
                            "Please approve the safety checks before continuing."
                        )
                        return
                else:
                    await agent.continue_task(user_message)
            else:
                await agent.start_task(user_message)

            while True:
                logger.info("Running loop iteration")
                self._session.status = "Running"
                user_message = None

                # Check for pause request
                if self._session.signal == "pause_requested":
                    logger.info("Session paused by user request")
                    self._session.status = "Paused"
                    await self._update_progress(status=self._session.status)
                    break

                if agent.requires_safety_check():
                    logger.debug("Requires safety check acknowledgment")
                    # Send safety check card
                    await self._context.send_activity(
                        Activity(
                            type=ActivityTypes.message,
                            attachments=[
                                Attachment(
                                    content_type="application/vnd.microsoft.card.adaptive",
                                    content=create_safety_check_card(
                                        self._session.id,
                                        self._session.current_step.pending_safety_checks,
                                    ),
                                )
                            ],
                        )
                    )
                    break
                elif agent.requires_user_input():
                    if self._session.current_step.last_message:
                        logger.debug(
                            f"\nAgent: {self._session.current_step.last_message}"
                        )
                        await self._context.send_activity(
                            f"⏩️ {self._session.current_step.last_message}"
                        )
                    break
                logger.info("Calling continue task")
                await agent.continue_task(user_message)
                await self._update_progress()
        except Exception as e:
            logger.error(f"Error in CUA agent: {e}")
            traceback.print_exc()
            self._session.status = "Error"

            await self._context.send_activity(
                Activity(
                    type=ActivityTypes.message,
                    attachments=[
                        Attachment(
                            content_type="application/vnd.microsoft.card.adaptive",
                            content=create_error_card(self._session.id, str(e)),
                        )
                    ],
                )
            )
            self._session.next_action = "user_interaction"
        finally:
            # Remove the signal handler
            loop.remove_signal_handler(signal.SIGINT)

    async def _build_cua_target(self) -> CUATarget:
        width = 1024  # Default width
        height = 768  # Default height

        if Config.USE_BROWSER:
            if self._session.browser is None:
                # Create new browser instance if none exists
                self._session.browser = Browser(width=width, height=height)
            # Initialize the browser (will reuse if already initialized)
            await self._session.browser.initialize()
            return self._session.browser
        else:
            machine = Machine(
                width=width,
                height=height,
                address=Config.VNC_ADDRESS,
                password=Config.VNC_PASSWORD,
            )
            return ScaledCUATarget(width=width, height=height, target=machine)

    async def _update_progress(self, status: str | None = None):
        """Update the Teams message with a progress card."""
        if status is not None:
            self._session.status = status

        # Map the current step's action to a string representation
        action_str = "No action"
        if self._session.current_step.call_action:
            if isinstance(
                self._session.current_step.call_action, ResponseFunctionToolCall
            ):
                # For dict actions (like navigate, go_back), use the name
                action_str = self._session.current_step.call_action.name
            elif self._session.current_step.call_action.type == "reasoning":
                # concatenate the reasoning content
                if self._session.current_step.call_action.content:
                    content = "\n".join(
                        [
                            item.text
                            for item in self._session.current_step.call_action.content
                        ]
                    )
                    action_str = content if content else "Reasoning"
                else:
                    action_str = "Reasoning"
            else:
                # For standard Action type, use the type field
                action_str = self._session.current_step.call_action.type

        current_step: ProgressStepDict = {
            "action": action_str,
            "next_action": self._session.current_step.next_action,
            "message": self._session.current_step.last_message,
        }

        # Convert history to the format expected by the card
        history: list[ProgressStepDict] = []
        for step in self._session.history:
            action_str = "No action"
            if step.call_action:
                if isinstance(step.call_action, ResponseFunctionToolCall):
                    action_str = step.call_action.name
                elif step.call_action.type == "reasoning":
                    # concatenate the reasoning content
                    if step.call_action.content:
                        content = "\n".join(
                            [item.text for item in step.call_action.content]
                        )
                        action_str = content if content else "Reasoning"
                    else:
                        action_str = "Reasoning"
                else:
                    action_str = step.call_action.type

            history.append(
                {
                    "action": action_str,
                    "next_action": self._session.current_step.next_action,
                    "message": step.last_message,
                }
            )

        if self._activity_id:
            activity = Activity(
                id=self._activity_id,
                type=ActivityTypes.message,
                attachment_layout=AttachmentLayoutTypes.list,
                attachments=[
                    Attachment(
                        content_type="application/vnd.microsoft.card.adaptive",
                        content=create_cua_progress_card(
                            screenshot=self._session.current_step.screenshot_base64,
                            current_step=current_step,
                            history=history,
                            status=status,
                        ),
                    )
                ],
            )
            await self._context.update_activity(activity=activity)
        else:
            # If no activity_id, send a new message
            sent_activity = await self._context.send_activity(
                Activity(
                    type=ActivityTypes.message,
                    attachment_layout=AttachmentLayoutTypes.list,
                    attachments=[
                        Attachment(
                            content_type="application/vnd.microsoft.card.adaptive",
                            content=create_cua_progress_card(
                                screenshot=self._session.current_step.screenshot_base64,
                                current_step=current_step,
                                history=history,
                                status=status,
                            ),
                        )
                    ],
                )
            )
            self._activity_id = sent_activity.id
