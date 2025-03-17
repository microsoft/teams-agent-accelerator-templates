"""
Copyright (c) Microsoft Corporation. All rights reserved.
Licensed under the MIT License.
"""

from abc import ABC, abstractmethod
from typing import Optional, TypedDict

from botbuilder.core import TurnContext
from botbuilder.schema import Activity
from teams.ai.citations import AIEntity


class LLMConfig(TypedDict):
    model: str
    api_key: str
    api_base: Optional[str]
    api_version: Optional[str]


class Agent(ABC):
    @abstractmethod
    async def run(self, context: TurnContext) -> str | None:
        pass

    async def send_string_message(
        self, context: TurnContext, message: str
    ) -> str | None:
        """Convenience function to send a string message to the user."""
        activity = Activity(
            type="message",
            text=message,
            entities=[AIEntity(additional_type=["AIGeneratedContent"], citation=[])],
        )
        res = await context.send_activity(activity)
        if res:
            return res.id

        return None
