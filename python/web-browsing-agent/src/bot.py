import asyncio
import sys
import traceback
from datetime import datetime, timedelta, timezone

from botbuilder.core import TurnContext
from botbuilder.schema import Activity, ActivityTypes, Attachment
from teams import Application, ApplicationOptions, TeamsAdapter
from teams.state import TurnState

from browser.browser_agent import MAX_EXECUTION_TIME_SECONDS, BrowserAgent
from cards import create_in_progress_card
from config import Config
from middleware.session_middleware import SessionMiddleware
from storage.session import Session, SessionState
from storage.session_storage import SessionStorage

config = Config()

# Initialize application with session management
session_storage = SessionStorage()
bot_app = Application(
    ApplicationOptions(
        bot_app_id=config.APP_ID,
        adapter=TeamsAdapter(config),
    )
)
bot_app._adapter.use(SessionMiddleware(session_storage))


@bot_app.conversation_update("membersAdded")
async def on_members_added(context: TurnContext):
    await context.send_activity("How can I help you today?")


@bot_app.adaptive_cards.action_submit("stop_browsing")
async def on_stop_browsing(context: TurnContext, _state: TurnState, data: dict):
    """Handle the user's request to stop a browsing session."""
    session_id = data.get("session_id")
    if not session_id:
        await context.send_activity("Could not find session ID to stop.")
        return

    session = context.has("session") and context.get("session")
    if session and session.id == session_id:
        session.state = SessionState.CANCELLATION_REQUESTED
    else:
        await context.send_activity("This session is not active.")
    await context.send_activity("Attempting to stop the current browsing session...")


async def run_agent(
    context: TurnContext, session: Session, query: str, activity_id: str
) -> str:
    """Run the browser agent with the given query."""
    browser_agent = BrowserAgent(context, session, activity_id)
    result = await browser_agent.run(query)
    return result


@bot_app.activity("message")
async def on_web_browse(context: TurnContext, turn_state: TurnState):
    """Handle web browsing requests from the user."""
    query = context.activity.text
    if not query:
        return

    session: Session | None = context.has("session") and context.get("session")

    # Check if there's an active session
    if (
        session
        and session.state == SessionState.STARTED
        and (
            session.created_at
            > datetime.now(timezone.utc) - timedelta(seconds=MAX_EXECUTION_TIME_SECONDS)
        )
    ):
        # Send card asking if user wants to stop current session
        card = create_in_progress_card(session.id)
        await context.send_activity(
            Activity(
                type=ActivityTypes.message,
                attachments=[
                    Attachment(
                        content_type="application/vnd.microsoft.card.adaptive",
                        content=card,
                    )
                ],
            )
        )
        return

    # Create new session if none exists or previous one is complete
    session = Session.create()
    session_setter = context.get("session_setter")
    await session_setter(session)

    conversation_ref = TurnContext.get_conversation_reference(context.activity)

    # Send initial message and get activity ID
    initial_response = await context.send_activity(
        "Starting up the browser agent to do this work."
    )
    activity_id = initial_response.id

    async def background_task():
        """Run the browser agent in the background and handle any errors."""
        result = await run_agent(context, session, query, activity_id)

        if isinstance(result, Exception):

            async def send_error(context: TurnContext):
                await context.send_activity(f"Error: {str(result)}")

            await context.adapter.continue_conversation(
                conversation_ref, send_error, config.APP_ID
            )

    asyncio.create_task(background_task())


@bot_app.error
async def on_error(context: TurnContext, error: Exception):
    # This check writes out errors to console log .vs. app insights.
    # NOTE: In production environment, you should consider logging this to Azure
    #       application insights.
    print(f"\n [on_turn_error] unhandled error: {error}", file=sys.stderr)
    traceback.print_exc()

    # Send a message to the user
    await context.send_activity("The bot encountered an error or bug.")
