"""
Copyright (c) Microsoft Corporation. All rights reserved.
Licensed under the MIT License.
"""

import json
import os
import sys
from typing import List, Literal

from botbuilder.core import TurnContext
from botbuilder.schema import Activity
from pydantic import BaseModel, Field
from teams.ai.citations import AIEntity, Appearance, ClientCitation
from teams_memory import BaseScopedMemoryModule, Topic

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from tech_assistant_agent.supported_tech_tasks import tasks_by_config
from utils import get_logger

logger = get_logger(__name__)

topics = [
    Topic(name="Device Type", description="The type of device the user has"),
    Topic(
        name="Operating System",
        description="The operating system for the user's device",
    ),
    Topic(name="Device year", description="The year of the user's device"),
]


class GetCandidateTasks(BaseModel):
    model_config = {"json_schema_extra": {"additionalProperties": False}}
    user_query: str = Field(description="A succinct description of the user's issue")
    candidate_task: Literal[
        "troubleshoot_device_issue",
        "troubleshoot_connectivity_issue",
        "troubleshoot_access_issue",
    ]


class GetMemorizedFields(BaseModel):
    model_config = {"json_schema_extra": {"additionalProperties": False}}
    memory_topics: List[Literal["Device Type", "Operating System", "Device year"]] = (
        Field(
            description="Topics for memories that the user may have revealed previously."
        )
    )


class UserDetail(BaseModel):
    model_config = {"json_schema_extra": {"additionalProperties": False}}
    field_name: str
    field_value: str
    memory_ids: List[str] = Field(description="A list of memory IDs for the field")


class ExecuteTask(BaseModel):
    model_config = {"json_schema_extra": {"additionalProperties": False}}
    succint_summary_of_issue: str
    user_details: List[UserDetail] = Field(
        description="A key value pair of the user's details"
    )


class ConfirmMemorizedFields(BaseModel):
    model_config = {"json_schema_extra": {"additionalProperties": False}}
    fields: List[UserDetail]


async def get_candidate_tasks(candidate_tasks: GetCandidateTasks) -> str:
    candidate_task = tasks_by_config[candidate_tasks.candidate_task]
    return candidate_task.model_dump_json()


async def get_memorized_fields(
    memory_module: BaseScopedMemoryModule, fields_to_retrieve: GetMemorizedFields
) -> str:
    fields: dict = {}
    for topic in fields_to_retrieve.memory_topics:
        topic = next((t.name for t in topics if t.name == topic), None)
        result = await memory_module.search_memories(topic=topic)
        logger.info(f"Getting memorized queries: {topic}")
        logger.info(result)
        logger.info("---")

        if result:
            fields[topic] = ", ".join([f"{r.id}. {r.content}" for r in result])
        else:
            fields[topic] = None
    return json.dumps(fields)


async def confirm_memorized_fields(
    memory_module: BaseScopedMemoryModule,
    fields_to_confirm: ConfirmMemorizedFields,
    context: TurnContext,
) -> str:
    logger.info(f"Confirming memorized fields: {fields_to_confirm}")
    if not fields_to_confirm.fields:
        logger.info("No fields to confirm")

        return "No fields to confirm"

    # Get memories and attributed messages
    cited_fields = []
    all_memory_ids = []
    field_details = []

    # First collect all memory IDs and field info
    for user_detail in fields_to_confirm.fields:
        if user_detail.memory_ids:
            all_memory_ids.extend(user_detail.memory_ids)
        field_details.append(
            (user_detail.field_name, user_detail.field_value, user_detail.memory_ids)
        )

    # Make single call to get all memories with attributions
    all_memories_with_attributions = None
    if all_memory_ids:
        all_memories_with_attributions = (
            await memory_module.get_memories_with_attributions(
                memory_ids=all_memory_ids
            )
        )

    # Map memories back to each field
    for field_name, field_value, memory_ids in field_details:
        field_memories = None
        if memory_ids and all_memories_with_attributions:
            field_memories = [
                m for m in all_memories_with_attributions if m.memory.id in memory_ids
            ]
        cited_fields.append((field_name, field_value, field_memories))

    # Build client citations to send in Teams
    memory_strs = []
    citations: List[ClientCitation] = []
    for cited_field in cited_fields:
        idx = len(citations) + 1
        field_name, field_value, field_memories = cited_field

        # Create a citation for each field with its memory and message attributions
        # If no attributions exist, the field will be displayed without a citation
        if field_memories is None or len(field_memories) == 0:
            memory_strs.append(f"{field_name}: {field_value}")
            continue
        else:
            memory_strs.append(f"{field_name}: {field_value} [{idx}]")

            memory = field_memories[0].memory
            messages = field_memories[0].messages  # type: ignore
            citations.append(
                ClientCitation(
                    str(idx),
                    Appearance(
                        name=field_name,
                        abstract=memory.content,
                        url=messages[0].deep_link if messages else None,
                    ),
                )
            )

    memory_details_str = "<br>".join([memory_str for memory_str in memory_strs])
    ai_entity = AIEntity(
        additional_type=["AIGeneratedContent"],
        citation=citations,
    )
    activity_with_card_attachment = Activity(
        type="message",
        text=f"Sure I would be happy to assist you. Can you confirm the following information?<br>{memory_details_str}",
        entities=[ai_entity] if ai_entity else None,
    )
    await context.send_activity(activity_with_card_attachment)
    return json.dumps(fields_to_confirm.model_dump())
