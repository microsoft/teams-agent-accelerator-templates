"""
Copyright (c) Microsoft Corporation. All rights reserved.
Licensed under the MIT License.
"""

import os
import sys

from botbuilder.core import TurnContext
from litellm import acompletion
from litellm.types.utils import Choices, ModelResponse

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from tech_assistant_agent.agent import Agent, LLMConfig
from tech_assistant_agent.prompts import execute_task_prompt
from tech_assistant_agent.tools import (
    ExecuteTask,
)


class TechSupportAgent(Agent):
    """
    Simple agent that tries to find the best response to a user's query.
    """

    def __init__(self, llm_config: LLMConfig, execute_task_args: ExecuteTask) -> None:
        self._llm_config = llm_config
        self.execute_task_args = execute_task_args
        super().__init__()

    async def run(self, context: TurnContext):
        system_prompt = execute_task_prompt.format(
            summary_of_issue=self.execute_task_args.succint_summary_of_issue,
            user_details=self.execute_task_args.user_details,
        )
        response = await acompletion(
            **self._llm_config,
            messages=[{"role": "system", "content": system_prompt}],
            temperature=0.9,
        )
        assert isinstance(response, ModelResponse)
        first_choice = response.choices[0]
        assert isinstance(first_choice, Choices)
        assert first_choice.message.content

        await self.send_string_message(context, first_choice.message.content)
        return first_choice.message.content
