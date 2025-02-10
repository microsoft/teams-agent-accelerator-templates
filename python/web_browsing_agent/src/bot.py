import asyncio
import os
import re
import sys
import traceback

from botbuilder.core import MemoryStorage, TurnContext
from teams import Application, ApplicationOptions, TeamsAdapter
from teams.state import TurnState as BaseTurnState

from browser.session import Session

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from browser.browser_agent import BrowserAgent
from config import Config

config = Config()


class TurnState(BaseTurnState):
    def __init__(self):
        super().__init__()
        self.session: Session = None


# Define storage and application
storage = MemoryStorage()
bot_app = Application[TurnState](
    ApplicationOptions(
        bot_app_id=config.APP_ID,
        storage=storage,
        adapter=TeamsAdapter(config),
    )
)


@bot_app.conversation_update("membersAdded")
async def on_members_added(context: TurnContext, state: TurnState):
    await context.send_activity("How can I help you today?")


async def reset_session(context: TurnContext, state: TurnState):
    if session := state.get("session"):
        session.session_state = []


async def run_agent(
    context: TurnContext, state: TurnState, query: str, activity_id: str
):
    browser_agent = BrowserAgent(context, state, activity_id)
    result = await browser_agent.run(query)
    return result


@bot_app.message(re.compile(".*web: .*"))
async def on_web_browse(context: TurnContext, state: TurnState):
    query = context.activity.text.split("web: ")[1]
    if not state.get("session"):
        state.set("session", Session.create())

    await reset_session(context, state)

    conversation_ref = TurnContext.get_conversation_reference(context.activity)

    # Send initial message and get activity ID
    initial_response = await context.send_activity(
        "Starting up the browser agent to do this work."
    )
    activity_id = initial_response.id

    async def background_task():
        result = await run_agent(context, state, query, activity_id)

        if isinstance(result, Exception):
            # If there was an error, send a new message instead of updating
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
