import asyncio
import logging
import traceback

from botbuilder.core import TurnContext
from teams import Application, ApplicationOptions, TeamsAdapter
from teams.state import TurnState

from config import Config
from cua.cua_agent import ComputerUseAgent
from middleware.session_middleware import SessionMiddleware
from storage.cua_session import CuaSession
from storage.session_storage import SessionStorage

config = Config()

logger = logging.getLogger(__name__)

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
async def on_members_added(context: TurnContext, state: TurnState):
    await context.send_activity(
        "How can I help you today? I am able to use the computer"
    )


@bot_app.adaptive_cards.action_submit("approve_safety_check")
async def on_approve_safety_check(context: TurnContext, state: TurnState, data: dict):
    """Handle the user's approval of a safety check."""
    session: CuaSession | None = context.has("session") and context.get("session")
    if not session:
        await context.send_activity("No active session found.")
        return

    # Set the signal to acknowledge safety checks
    session.signal = "acknowledged_pending_safety_checks"

    # Continue the task with the approved safety check
    await run_cua_agent(context, session, "", None)


@bot_app.adaptive_cards.action_submit("toggle_pause")
async def on_toggle_pause(context: TurnContext, state: TurnState, data: dict):
    """Handle the user's request to pause/resume the session."""
    session: CuaSession | None = context.has("session") and context.get("session")
    if not session:
        await context.send_activity("No active session found.")
        return

    current_status = data.get("current_status", "Running")
    if current_status == "Running":
        session.signal = "pause_requested"
        await context.send_activity("Pausing the session...")
    else:
        session.signal = None
        await context.send_activity("Resuming the session...")
        # Continue the task with empty message since we're just resuming
        await run_cua_agent(context, session, "", None)


async def run_cua_agent(
    context: TurnContext, session: CuaSession, query: str, activity_id: str | None
) -> str:
    """Run the CUA agent with the given query."""
    cua_agent = ComputerUseAgent(context, session, activity_id)
    logger.info(f"Running CUA agent with query: {query}")
    result = await cua_agent.run(query)
    return result


@bot_app.activity("message")
async def on_cua(context: TurnContext, state: TurnState):
    """Handle web browsing requests from the user."""
    logger.info(f"Received message: {context.activity.text}")
    query = context.activity.text
    if not query:
        return

    session: CuaSession | None = context.has("session") and context.get("session")

    # Check if there's an active session
    if session and session.current_step.next_action not in ("user_interaction"):
        # Send card asking if user wants to stop current session
        await context.send_activity("The session is already in progress.")
        return

    # Create new session if none exists or previous one is complete
    is_new_session = session is None
    session = session or CuaSession.create()
    session_setter = context.get("session_setter")
    await session_setter(session)

    conversation_ref = TurnContext.get_conversation_reference(context.activity)

    # Send initial message and get activity ID
    if is_new_session:
        initial_response = await context.send_activity(
            "Starting up the CUA agent to do this work."
        )
        activity_id = initial_response.id
    else:
        activity_id = None

    async def background_task():
        """Run the cua agent in the background and handle any errors."""
        result = await run_cua_agent(context, session, query, activity_id)

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
    logger.error(f"\n [on_turn_error] unhandled error: {error}")
    traceback.print_exc()

    # Send a message to the user
    await context.send_activity("The bot encountered an error or bug.")
