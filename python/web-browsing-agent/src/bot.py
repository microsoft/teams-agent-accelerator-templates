import asyncio
import logging
import sys
import traceback
from datetime import datetime, timedelta, timezone

from microsoft_teams.api import (
    AdaptiveCardInvokeActivity,
    ConversationReference,
    InstalledActivity,
    MessageActivity,
    MessageActivityInput,
)
from microsoft_teams.api.models.attachment.attachment import Attachment
from microsoft_teams.apps import ActivityContext, App

from browser.browser_agent import MAX_EXECUTION_TIME_SECONDS, BrowserAgent
from cards import create_in_progress_card
from storage.session import Session, SessionState
from storage.session_storage import SessionStorage

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")

app = App()
session_storage = SessionStorage()


@app.on_install_add
async def on_install(ctx: ActivityContext[InstalledActivity]):
    await ctx.send("How can I help you today?")


@app.on_card_action_execute("stop_browsing")
async def on_stop_browsing(ctx: ActivityContext[AdaptiveCardInvokeActivity]):
    """Handle the user's request to stop a browsing session."""
    data = ctx.activity.value.data if ctx.activity.value else None
    session_id = data.get("session_id") if data else None

    if not session_id:
        await ctx.send("Could not find session ID to stop.")
        return None

    user_id = ctx.activity.from_.aad_object_id if ctx.activity.from_ else None
    session = await session_storage.get_session(user_id) if user_id else None

    if session and session.id == session_id:
        session.state = SessionState.CANCELLATION_REQUESTED
        await ctx.send("Attempting to stop the current browsing session...")
    else:
        await ctx.send("This session is not active.")
    return None


@app.on_message
async def on_web_browse(ctx: ActivityContext[MessageActivity]):
    """Handle web browsing requests from the user."""
    query = ctx.activity.text
    if not query:
        return

    user_id = ctx.activity.from_.aad_object_id if ctx.activity.from_ else None
    session = await session_storage.get_session(user_id) if user_id else None

    # Check if there's an active session
    if (
        session
        and session.state == SessionState.STARTED
        and (session.created_at > datetime.now(timezone.utc) - timedelta(seconds=MAX_EXECUTION_TIME_SECONDS))
    ):
        card = create_in_progress_card(session.id)
        activity = MessageActivityInput()
        activity.attachments = [Attachment(content_type="application/vnd.microsoft.card.adaptive", content=card)]
        await ctx.send(activity)
        return

    # Create new session
    session = Session.create()
    if user_id:
        await session_storage.set_session(user_id, session)

    # Store conversation reference for background task
    conversation_ref = ctx.conversation_ref

    # Send initial message and get activity ID for progress updates
    sent = await ctx.send("Starting up the browser agent to do this work.")
    activity_id = sent.id

    async def background_task():
        """Run the browser agent in the background and handle any errors."""
        try:
            browser_agent = BrowserAgent(app, conversation_ref, session, activity_id)
            await browser_agent.run(query)
        except Exception as e:
            logger.error(f"Background task error: {e}")
            traceback.print_exc()
            try:
                await app.send(conversation_ref.conversation.id, f"Error: {str(e)}")
            except Exception:
                pass

    asyncio.create_task(background_task())


@app.event("error")
async def on_error(event):
    print(f"\n [on_error] unhandled error: {event.error}", file=sys.stderr)
    traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(app.start())
