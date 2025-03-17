"""
Copyright (c) Microsoft Corporation. All rights reserved.
Licensed under the MIT License.
"""

import json
import os
import sys
from typing import List

from botbuilder.core import TurnContext
from litellm import acompletion
from litellm.types.utils import Choices, ModelResponse
from teams_memory import (
    BaseScopedMemoryModule,
    InternalMessageInput,
)

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from tech_assistant_agent.agent import Agent, LLMConfig
from tech_assistant_agent.prompts import system_prompt
from tech_assistant_agent.tech_agent import TechSupportAgent
from tech_assistant_agent.tools import (
    ConfirmMemorizedFields,
    ExecuteTask,
    GetCandidateTasks,
    GetMemorizedFields,
    confirm_memorized_fields,
    get_candidate_tasks,
    get_memorized_fields,
)
from utils import get_logger

logger = get_logger(__name__)


class TechAssistantAgent(Agent):
    def __init__(self, llm_config: LLMConfig) -> None:
        self._llm_config = llm_config
        super().__init__()

    async def run(self, context: TurnContext):
        memory_module: BaseScopedMemoryModule = context.get("memory_module")
        assert memory_module
        messages = await memory_module.retrieve_conversation_history(last_minutes=1)
        llm_messages: List = [
            {
                "role": "system",
                "content": system_prompt,
            },
            *[
                {
                    "role": "user" if message.type == "user" else "assistant",
                    "content": message.content,
                }
                for message in messages
            ],
        ]

        max_turns = 5
        should_break = False  # Flag to indicate if we should break the outer loop
        for _ in range(max_turns):
            response = await acompletion(
                **self._llm_config,
                messages=llm_messages,
                tools=self._get_available_functions(),
                tool_choice="auto",
                temperature=0,
            )
            assert isinstance(response, ModelResponse)
            first_choice = response.choices[0]
            assert isinstance(first_choice, Choices)

            message = first_choice.message

            if message.tool_calls is None and message.content is not None:
                await self.send_string_message(context, message.content)
                break
            elif message.tool_calls is None and message.content is None:
                logger.info("No tool calls and no content")
                break
            elif message.tool_calls is None:
                logger.info("Tool calls but no content")

                break

            for tool_call in message.tool_calls:
                function_name = tool_call.function.name
                function_args = tool_call.function.arguments

                if function_name == "get_candidate_tasks":
                    args = GetCandidateTasks.model_validate_json(function_args)
                    res = await get_candidate_tasks(args)
                elif function_name == "get_memorized_fields":
                    args = GetMemorizedFields.model_validate_json(function_args)
                    res = await get_memorized_fields(memory_module, args)
                elif function_name == "confirm_memorized_fields":
                    args = ConfirmMemorizedFields.model_validate_json(function_args)
                    res = await confirm_memorized_fields(memory_module, args, context)
                    should_break = True
                elif function_name == "execute_task":
                    args = ExecuteTask.model_validate_json(function_args)
                    tech_support_agent = TechSupportAgent(self._llm_config, args)
                    res = await tech_support_agent.run(context)
                    should_break = True
                else:
                    res = None

                if res is not None:
                    llm_messages.append(
                        {
                            "role": "assistant",
                            "content": None,
                            "tool_calls": [tool_call],
                        }
                    )
                    llm_messages.append(
                        {
                            "role": "tool",
                            "tool_call_id": tool_call.id,
                            "content": str(res),
                        }
                    )
                    await self._add_internal_message(
                        context,
                        json.dumps(
                            {
                                "tool_call_name": function_name,
                                "result": res,
                            }
                        ),
                    )
                else:
                    break

                if should_break:
                    break

            if should_break:
                break  # Break the outer loop

    def _get_available_functions(self):
        return [
            {
                "type": "function",
                "function": {
                    "name": "get_candidate_tasks",
                    "description": "Identify the task based on user's query",
                    "parameters": GetCandidateTasks.model_json_schema(),
                    "strict": True,
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "get_memorized_fields",
                    "description": "Retrieve values for fields that have been previously memorized",
                    "parameters": GetMemorizedFields.model_json_schema(),
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "confirm_memorized_fields",
                    "description": "Confirm the fields that have been previously memorized",
                    "parameters": ConfirmMemorizedFields.model_json_schema(),
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "execute_task",
                    "description": "Execute a troubleshooting task",
                    "parameters": ExecuteTask.model_json_schema(),
                    "strict": True,
                },
            },
        ]

    async def _add_internal_message(self, context: TurnContext, content: str):
        conversation_ref_dict = TurnContext.get_conversation_reference(context.activity)
        memory_module: BaseScopedMemoryModule = context.get("memory_module")
        await memory_module.add_message(
            InternalMessageInput(
                content=content,
                author_id=conversation_ref_dict.bot.id,
                conversation_ref=memory_module.conversation_ref,
            )
        )
        return True
