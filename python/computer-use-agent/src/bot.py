import asyncio
import logging
import traceback

from microsoft_teams.api import (
    AdaptiveCardInvokeActivity,
    InstalledActivity,
    MessageActivity,
    MessageActivityInput,
)
from microsoft_teams.apps import ActivityContext, App

from cua.cua_agent import ComputerUseAgent
from storage.cua_session import CuaSession
from storage.session_storage import SessionStorage

logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)

app = App()
session_storage = SessionStorage()


@app.on_install_add
async def on_install(ctx: ActivityContext[InstalledActivity]):
    await ctx.send("How can I help you today? I am able to use the computer")


@app.on_card_action_execute("approve_safety_check")
async def on_approve_safety_check(ctx: ActivityContext[AdaptiveCardInvokeActivity]):
    """Handle the user's approval of a safety check."""
    user_id = ctx.activity.from_.aad_object_id if ctx.activity.from_ else None
    session = await session_storage.get_session(user_id) if user_id else None

    if not session:
        await ctx.send("No active session found.")
        return None

    # Set the signal to acknowledge safety checks
    session.signal = "acknowledged_pending_safety_checks"

    # Continue the task with the approved safety check
    conversation_ref = ctx.conversation_ref
    cua_agent = ComputerUseAgent(app, conversation_ref, session, None)
    await cua_agent.run("")
    return None


@app.on_card_action_execute("toggle_pause")
async def on_toggle_pause(ctx: ActivityContext[AdaptiveCardInvokeActivity]):
    """Handle the user's request to pause/resume the session."""
    user_id = ctx.activity.from_.aad_object_id if ctx.activity.from_ else None
    session = await session_storage.get_session(user_id) if user_id else None

    if not session:
        await ctx.send("No active session found.")
        return None

    current_status = session.status
    if current_status == "Running":
        session.signal = "pause_requested"
        session.status = "Paused"
        await ctx.send("Pausing the session...")
    else:
        session.signal = None
        session.status = "Running"
        await ctx.send("Resuming the session...")
        # Continue the task with empty message since we're just resuming
        conversation_ref = ctx.conversation_ref
        cua_agent = ComputerUseAgent(app, conversation_ref, session, None)
        await cua_agent.run("")
    return None


@app.on_card_action_execute("retry")
async def on_retry(ctx: ActivityContext[AdaptiveCardInvokeActivity]):
    """Handle the user's request to retry the last action."""
    user_id = ctx.activity.from_.aad_object_id if ctx.activity.from_ else None
    session = await session_storage.get_session(user_id) if user_id else None

    if not session:
        await ctx.send("No active session found.")
        return None

    if session.status == "Error":
        session.status = "Running"
        conversation_ref = ctx.conversation_ref
        cua_agent = ComputerUseAgent(app, conversation_ref, session, None)
        await cua_agent.run("")
    else:
        await ctx.send("The session is not in an error state.")
    return None


@app.on_message
async def on_cua(ctx: ActivityContext[MessageActivity]):
    """Handle computer use requests from the user."""
    logger.info(f"Received message: {ctx.activity.text}")
    query = ctx.activity.text
    if not query:
        return

    user_id = ctx.activity.from_.aad_object_id if ctx.activity.from_ else None
    session = await session_storage.get_session(user_id) if user_id else None

    # Check if there's an active session
    if session and session.current_step.next_action != "user_interaction":
        await ctx.send("The session is already in progress.")
        return

    # Create new session if none exists or previous one is complete
    is_new_session = session is None
    session = session or CuaSession.create()
    if user_id:
        await session_storage.set_session(user_id, session)

    # Store conversation reference for background task
    conversation_ref = ctx.conversation_ref

    # Send initial message and get activity ID
    if is_new_session:
        sent = await ctx.send("Starting up the CUA agent to do this work.")
        activity_id = sent.id
    else:
        activity_id = None

    async def background_task():
        """Run the CUA agent in the background and handle any errors."""
        try:
            cua_agent = ComputerUseAgent(app, conversation_ref, session, activity_id)
            await cua_agent.run(query)
        except Exception as e:
            logger.error(f"Background task error: {e}")
            traceback.print_exc()
            try:
                error_activity = MessageActivityInput(text=f"Error: {str(e)}")
                await app.activity_sender.send(error_activity, conversation_ref)
            except Exception:
                pass

    asyncio.create_task(background_task())


@app.event("error")
async def on_error(event):
    logger.error(f"\n [on_error] unhandled error: {event.error}")
    traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(app.start())
