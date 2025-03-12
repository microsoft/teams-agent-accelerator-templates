"""
Copyright (c) Microsoft Corporation. All rights reserved.
Licensed under the MIT License.
"""

import os

from dotenv import load_dotenv

load_dotenv()


class Config:
    """Bot Configuration"""

    PORT = 3978
    APP_ID = os.environ.get("BOT_ID", "")
    APP_PASSWORD = os.environ.get("BOT_PASSWORD", "")

    # LLM Configuration
    AZURE_OPENAI_API_BASE = os.environ.get("AZURE_OPENAI_ENDPOINT", None)
    AZURE_OPENAI_API_KEY = os.environ.get("AZURE_OPENAI_API_KEY", None)
    AZURE_OPENAI_DEPLOYMENT = os.environ.get("AZURE_OPENAI_MODEL_DEPLOYMENT_NAME", None)
    AZURE_OPENAI_API_VERSION = os.environ.get("AZURE_OPENAI_API_VERSION", None)
    OPENAI_MODEL_NAME = os.environ.get("OPENAI_MODEL_NAME", None)
    OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", None)

    # By default, we use VNC to control the computer.
    # But you may use a playwright browser instead.
    USE_BROWSER = os.environ.get("USE_BROWSER", "false").lower() == "true"
    VNC_ADDRESS = os.environ.get("VNC_ADDRESS", "localhost::5900")
    VNC_PASSWORD = os.environ.get("VNC_PASSWORD", "secret")
