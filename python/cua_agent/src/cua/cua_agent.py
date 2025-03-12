import asyncio
import logging
import signal

from botbuilder.core import TurnContext
from botbuilder.schema import Activity, ActivityTypes, Attachment, AttachmentLayoutTypes

from cards import create_cua_progress_card, create_safety_check_card
from config import Config
from cua.browser.browser import Browser
from cua.computer_use import ComputerUse
from cua.cua_target import CUATarget
from cua.scaler import Scaler
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
            cua_target = self._build_cua_target()
            agent = ComputerUse(cua_target, self._session)

            user_message = task
            if self._session.current_step:
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
                logger.debug("Running loop iteration")
                user_message = None

                # Check for pause request
                if self._session.signal == "pause_requested":
                    logger.info("Session paused by user request")
                    await self._update_progress(status="Paused")
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
                logger.debug("Calling continue task")
                await agent.continue_task(user_message)
                await self._update_progress()
        except Exception as e:
            logger.error(f"Error in CUA agent: {e}")
            await self._context.send_activity(f"An error occurred: {str(e)}")
        finally:
            # Remove the signal handler
            loop.remove_signal_handler(signal.SIGINT)
            return

    def interrupt(self):
        """Interrupt the current execution loop."""
        self._interrupted = True

    def _build_cua_target(self) -> CUATarget:
        width = 1024  # Default width
        height = 768  # Default height

        if Config.USE_BROWSER:
            return Browser(width=width, height=height)
        else:
            machine = Machine(
                width=width,
                height=height,
                address=Config.VNC_ADDRESS,
                password=Config.VNC_PASSWORD,
            )
            return Scaler(width=width, height=height, target=machine)

    async def _update_progress(self, status: str = "Running"):
        """Update the Teams message with a progress card."""
        current_step = {
            "action": (
                self._session.current_step.computer_action.type
                if self._session.current_step.computer_action
                else "No action"
            ),
            "next_action": self._session.current_step.next_action,
            "message": self._session.current_step.last_message,
        }

        # Convert history to the format expected by the card
        history = []
        for step in self._session.history:
            history.append(
                {
                    "action": (
                        step.computer_action.type
                        if step.computer_action
                        else "No action"
                    ),
                    "next_action": self._session.current_step.next_action,  # We don't store this in history currently
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
