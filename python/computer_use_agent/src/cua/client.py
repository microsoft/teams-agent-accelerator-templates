import logging

from openai import AsyncAzureOpenAI, AsyncOpenAI

from config import Config

# Get logger for this module
logger = logging.getLogger(__name__)


def setup_openai_client():
    """Set up and return the appropriate OpenAI client based on configuration."""
    if Config.AZURE_OPENAI_API_KEY:
        logger.info("Using Azure OpenAI")
        client = AsyncAzureOpenAI(
            azure_endpoint=Config.AZURE_OPENAI_API_BASE,
            azure_deployment=Config.AZURE_OPENAI_DEPLOYMENT,
            api_version=Config.AZURE_OPENAI_API_VERSION,
            api_key=Config.AZURE_OPENAI_API_KEY,
        )
        model = Config.AZURE_OPENAI_DEPLOYMENT
    else:
        logger.info(
            "Using OpenAI for computer use using key: %s", Config.OPENAI_API_KEY
        )
        client = AsyncOpenAI(
            api_key=Config.OPENAI_API_KEY,
        )
        model = "computer-use-preview"

    return client, model
