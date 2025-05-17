"""
Copyright (c) Microsoft Corporation. All rights reserved.
Licensed under the MIT License.
"""

import logging
import os
import traceback

from botbuilder.core import MemoryStorage, TurnContext
from teams import Application, ApplicationOptions, TeamsAdapter
from teams.state import TurnState
from teams_memory import (
    LLMConfig,
    MemoryMiddleware,
    MemoryModuleConfig,
    SQLiteStorageConfig,
    configure_logging,
)

from config import Config
from tech_assistant_agent.agent import LLMConfig as AgentLLMConfig
from tech_assistant_agent.primary_agent import TechAssistantAgent
from tech_assistant_agent.tools import topics
from utils import get_logger

logger = get_logger(__name__)
config = Config()

memory_llm_config: dict
if config.AZURE_OPENAI_API_KEY:
    memory_llm_config = {
        "model": f"azure/{config.AZURE_OPENAI_DEPLOYMENT}",
        "api_key": config.AZURE_OPENAI_API_KEY,
        "api_base": config.AZURE_OPENAI_API_BASE,
        "api_version": config.AZURE_OPENAI_API_VERSION,
        "embedding_model": f"azure/{config.AZURE_OPENAI_EMBEDDING_DEPLOYMENT}",
    }
elif config.OPENAI_API_KEY:
    memory_llm_config = {
        "model": config.OPENAI_MODEL_NAME,
        "api_key": config.OPENAI_API_KEY,
        "api_base": None,
        "api_version": None,
        "embedding_model": config.OPENAI_EMBEDDING_MODEL_NAME,
    }
else:
    raise ValueError("You need to provide either OpenAI or Azure OpenAI credentials")

agent_llm_config = AgentLLMConfig(
    model=memory_llm_config["model"],
    api_key=memory_llm_config["api_key"],
    api_base=memory_llm_config["api_base"],
    api_version=memory_llm_config["api_version"],
)

# Define storage and application
storage = MemoryStorage()
bot_app = Application[TurnState](
    ApplicationOptions(
        bot_app_id=config.APP_ID,
        storage=storage,
        adapter=TeamsAdapter(config),
    )
)

memory_middleware = MemoryMiddleware(
    config=MemoryModuleConfig(
        llm=LLMConfig(**memory_llm_config),
        storage=SQLiteStorageConfig(
            db_path=os.path.join(os.path.dirname(__file__), "data", "memory.db")
        ),
        timeout_seconds=60,
        buffer_size=20,
        topics=topics,
    )
)
configure_logging(logging.INFO)
bot_app.adapter.use(memory_middleware)


@bot_app.conversation_update("membersAdded")
async def on_members_added(context: TurnContext, state: TurnState):
    await context.send_activity(
        "Hello! I am a tech assistant bot. How can I help you today?"
    )
    return True


@bot_app.activity("message")
async def on_message(context: TurnContext, state: TurnState):
    tech_assistant_agent = TechAssistantAgent(agent_llm_config)
    await tech_assistant_agent.run(context)
    return True


@bot_app.error
async def on_error(context: TurnContext, error: Exception):
    logger.error(f"\n [on_turn_error] unhandled error: {error}")
    traceback.print_exc()
    await context.send_activity("The bot encountered an error or bug.")
