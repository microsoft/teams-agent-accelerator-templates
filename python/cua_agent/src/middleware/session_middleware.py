from typing import Awaitable, Callable

from botbuilder.core import Middleware, TurnContext

from storage.cua_session import CuaSession
from storage.session_storage import SessionStorage


class SessionMiddleware(Middleware):
    """Middleware that handles session management for the bot.

    This middleware:
    1. Gets the user's AAD ID from the activity
    2. Retrieves any existing session from storage
    3. Provides a session setter function to the turn context
    """

    def __init__(self, session_storage: SessionStorage):
        self._session_storage = session_storage

    async def on_turn(self, context: TurnContext, logic: Callable[[], Awaitable]):
        # Get user ID from the activity
        conversation_ref = TurnContext.get_conversation_reference(context.activity)
        user_aad_id = conversation_ref.user.aad_object_id
        if user_aad_id:
            # Add session setter to context
            async def session_setter(session: CuaSession):
                await self._session_storage.set_session(user_aad_id, session)
                context.set("session", session)

            context.set("session_setter", session_setter)

            # Get and set existing session if it exists
            session = await self._session_storage.get_session(user_aad_id)
            if session:
                context.set("session", session)

        await logic()
