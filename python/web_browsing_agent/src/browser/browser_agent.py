import asyncio
import os

from botbuilder.core import TurnContext
from botbuilder.schema import Activity, ActivityTypes, Attachment, AttachmentLayoutTypes
from browser.session import Session, SessionState, SessionStepState
from browser_use import Agent, Browser, BrowserConfig
from browser_use.agent.views import AgentHistoryList, AgentOutput
from browser_use.browser.context import BrowserContext
from browser_use.browser.views import BrowserState
from config import Config
from langchain_openai import AzureChatOpenAI, ChatOpenAI


class BrowserAgent:
    def __init__(self, context: TurnContext, session: Session, activity_id: str):
        self.context = context
        self.session = session
        self.activity_id = activity_id
        self.browser = Browser(
            config=BrowserConfig(
                headless=True if os.environ.get("IS_DOCKER_ENV", None) else False,
            )
        )
        self.browser_context = BrowserContext(browser=self.browser)
        self.llm = self._setup_llm()
        self.agent = None

    @staticmethod
    def _setup_llm():
        if Config.AZURE_OPENAI_API_KEY:
            return AzureChatOpenAI(
                azure_endpoint=Config.AZURE_OPENAI_API_BASE,
                azure_deployment=Config.AZURE_OPENAI_DEPLOYMENT,
                openai_api_version=Config.AZURE_OPENAI_API_VERSION,
                model_name=Config.AZURE_OPENAI_DEPLOYMENT,  # BrowserUse has a bug where this model_name is required
            )
        return ChatOpenAI(
            model=Config.OPENAI_MODEL_NAME,
            api_key=Config.OPENAI_API_KEY,
        )

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

        self.session.session_state.append(step)

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
        if self.session.state == SessionState.CANCELLATION_REQUESTED and self.agent:
            self.agent.stop()
            asyncio.create_task(
                self._send_final_activity(
                    "Session stopped by user", include_screenshot=False
                )
            )
            return

        # Handle screenshot and update card in one go
        asyncio.create_task(
            self._handle_screenshot_and_emit(
                output,
            )
        )

    async def _send_final_activity(
        self, message: str, include_screenshot: bool = True
    ) -> None:
        # Get the last screenshot if available and if requested
        last_screenshot = (
            self.session.session_state[-1].screenshot
            if self.session.session_state and include_screenshot
            else None
        )

        # First update the progress card
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

        # Then send a final results card
        final_card = {
            "type": "AdaptiveCard",
            "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
            "version": "1.5",
            "body": [
                {
                    "type": "Container",
                    "style": "emphasis",
                    "items": [
                        {
                            "type": "TextBlock",
                            "text": "✨ Task Complete",
                            "weight": "Bolder",
                            "size": "Large",
                            "wrap": True,
                        }
                    ],
                },
                {
                    "type": "Container",
                    "items": [
                        {
                            "type": "TextBlock",
                            "text": message,
                            "wrap": True,
                        }
                    ],
                },
            ],
        }

        # Add screenshot to final card if available
        if last_screenshot:
            final_card["body"].insert(
                1,
                {
                    "type": "Image",
                    "url": f"data:image/png;base64,{last_screenshot}",
                    "msTeams": {
                        "allowExpand": True,
                    },
                },
            )

        await self.context.send_activity(
            Activity(
                type=ActivityTypes.message,
                attachments=[
                    Attachment(
                        content_type="application/vnd.microsoft.card.adaptive",
                        content=final_card,
                    )
                ],
            )
        )

    def done_callback(self, result) -> None:
        self.session.state = SessionState.DONE

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
        self.agent = agent
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
            self.session.state = SessionState.ERROR
            error_message = f"Error during browser agent execution: {str(e)}"
            await self._send_final_activity(error_message)
            return error_message
