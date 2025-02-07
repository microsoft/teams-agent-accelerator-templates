import asyncio
import logging
import os

from botbuilder.core import TurnContext
from botbuilder.schema import Activity, Attachment, AttachmentLayoutTypes
from browser.session import Session, SessionStepState
from browser_use import Agent, Browser, BrowserConfig
from browser_use.agent.views import AgentHistoryList, AgentOutput
from browser_use.browser.context import BrowserContext
from browser_use.browser.views import BrowserState
from langchain_openai import AzureChatOpenAI, ChatOpenAI
from teams.state import TurnState


class BrowserAgent:
    def __init__(self, context: TurnContext, state: TurnState, activity_id: str):
        self.context = context
        self.state = state
        self.activity_id = activity_id
        self.browser = Browser(
            config=BrowserConfig(
                headless=True if os.environ.get("IS_DOCKER_ENV") else None,
            )
        )
        self.browser_context = BrowserContext(browser=self.browser)
        self.llm = self._setup_llm()

    @staticmethod
    def _setup_llm():
        if azure_endpoint := os.environ.get("AZURE_OPENAI_API_BASE", None):
            return AzureChatOpenAI(
                azure_endpoint=azure_endpoint,
                azure_deployment=os.environ["AZURE_OPENAI_DEPLOYMENT"],
                openai_api_version=os.environ["AZURE_OPENAI_API_VERSION"],
                model_name=os.environ[
                    "AZURE_OPENAI_DEPLOYMENT"
                ],  # BrowserUse has a bug where this model_name is required
            )
        return ChatOpenAI(model=os.environ["OPENAI_MODEL_NAME"])

    def _create_progress_card(
        self,
        step: SessionStepState,
        agent_history: AgentHistoryList = None,
    ) -> dict:
        card = {
            "type": "AdaptiveCard",
            "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
            "version": "1.5",
            "body": [],
        }

        # Add screenshot if available
        if step.screenshot:
            card["body"].append(
                {
                    "type": "Image",
                    "url": f"data:image/png;base64,{step.screenshot}",
                    "msTeams": {
                        "allowExpand": True,
                    },
                }
            )
        # Add progress section with next goal
        if step.next_goal:
            progress_section = {
                "type": "ColumnSet",
                "columns": [
                    {
                        "type": "Column",
                        "width": "auto",
                        "items": [{"type": "TextBlock", "text": "🎯", "wrap": True}],
                    },
                    {
                        "type": "Column",
                        "width": "stretch",
                        "items": [
                            {
                                "type": "TextBlock",
                                "text": (
                                    step.next_goal
                                    if step.next_goal
                                    else "Task in progress..."
                                ),
                                "wrap": True,
                            }
                        ],
                    },
                ],
            }
            card["body"].append(progress_section)

        # Add action/result section
        status_section = {
            "type": "ColumnSet",
            "columns": [
                {
                    "type": "Column",
                    "width": "auto",
                    "items": [{"type": "TextBlock", "text": "⚡", "wrap": True}],
                },
                {
                    "type": "Column",
                    "width": "stretch",
                    "items": [
                        {
                            "type": "TextBlock",
                            "text": step.action,
                            "wrap": True,
                        }
                    ],
                },
            ],
        }
        card["body"].append(status_section)

        # Add history toggle and fact set if history exists
        if agent_history and agent_history.history:
            # Get all model thoughts and actions
            thoughts = agent_history.model_thoughts()
            actions = agent_history.model_actions()

            facts = []
            for i, (thought, action) in enumerate(zip(thoughts, actions)):
                action_name = list(action.keys())[0] if action else "No action"
                facts.append(
                    {
                        "title": f"Step {i+1}",
                        "value": f"🤔 Thought: {thought.evaluation_previous_goal}\n"
                        f"🎯 Goal: {thought.next_goal}\n"
                        f"⚡ Action: {action_name}",
                    }
                )

            card["body"].extend(
                [
                    {
                        "type": "ActionSet",
                        "actions": [
                            {
                                "type": "Action.ToggleVisibility",
                                "title": "📝 Show History",
                                "targetElements": ["history_facts"],
                            }
                        ],
                    },
                    {
                        "type": "FactSet",
                        "id": "history_facts",
                        "isVisible": False,
                        "facts": facts,
                    },
                ]
            )

        return card

    async def _handle_screenshot_and_emit(
        self,
        session: Session,
        output: AgentOutput,
    ) -> None:
        screenshot_new = await self.browser_context.take_screenshot()
        actions = (
            [action.model_dump_json(exclude_unset=True) for action in output.action]
            if output.action
            else []
        )

        step = SessionStepState(
            screenshot=screenshot_new,
            action=output.current_state.evaluation_previous_goal,
            memory=output.current_state.memory,
            next_goal=output.current_state.next_goal,
            actions=actions,
        )

        session.session_state.append(step)

        # Update the Teams message with card
        activity = Activity(
            id=self.activity_id,
            type="message",
            attachment_layout=AttachmentLayoutTypes.list,
            attachments=[
                Attachment(
                    content_type="application/vnd.microsoft.card.adaptive",
                    content=self._create_progress_card(
                        step=step,
                        agent_history=self.agent_history,
                    ),
                )
            ],
        )
        await self.context.update_activity(activity=activity)

    def step_callback(
        self, state: BrowserState, output: AgentOutput, step_number: int
    ) -> None:
        if self.state.session:
            # Handle screenshot and update card in one go
            asyncio.create_task(
                self._handle_screenshot_and_emit(
                    self.state.session,
                    output,
                )
            )
        else:
            logging.warning("Session not available to store step state")

    async def _send_final_activity(self, message: str) -> None:
        if self.state.session:
            # Get the last screenshot if available
            last_screenshot = (
                self.state.session.session_state[-1].screenshot
                if self.state.session.session_state
                else None
            )

            step = SessionStepState(action=message, screenshot=last_screenshot)

            activity = Activity(
                id=self.activity_id,
                type="message",
                attachment_layout=AttachmentLayoutTypes.list,
                attachments=[
                    Attachment(
                        content_type="application/vnd.microsoft.card.adaptive",
                        content=self._create_progress_card(
                            step=step, agent_history=self.agent_history
                        ),
                    )
                ],
            )
            await self.context.update_activity(activity=activity)
        else:
            logging.warning("Session not available to store final state")

    def done_callback(self, result) -> None:
        action_results = result.action_results()
        if action_results and (last_result := action_results[-1]):
            final_result = last_result.extracted_content
            asyncio.create_task(self._send_final_activity(final_result))
        else:
            asyncio.create_task(self._send_final_activity("No results found"))

    async def run(self, query: str) -> str:
        agent = Agent(
            task=query,
            llm=self.llm,
            register_new_step_callback=self.step_callback,
            register_done_callback=self.done_callback,
            browser_context=self.browser_context,
            generate_gif=False,
        )
        self.agent_history = agent.history

        try:
            result = await agent.run()
            asyncio.create_task(self.browser_context.close())

            action_results = result.action_results()
            return (
                action_results[-1].extracted_content
                if action_results and action_results[-1]
                else "No results found"
            )

        except Exception as e:
            error_message = f"Error during browser agent execution: {str(e)}"
            await self._send_final_activity(error_message)
            return error_message
