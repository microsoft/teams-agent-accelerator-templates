from openai.types.responses.response_computer_tool_call import (
    PendingSafetyCheck,
)


def create_in_progress_card(session_id: str) -> dict:
    """Create an adaptive card that asks the user if they want to stop the current session."""
    return {
        "type": "AdaptiveCard",
        "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
        "version": "1.5",
        "body": [
            {
                "type": "TextBlock",
                "text": "A browsing session is still in progress. Do you want to stop it?",
                "wrap": True,
            }
        ],
        "actions": [
            {
                "type": "Action.Submit",
                "title": "Yes",
                "verb": "stop_browsing",
                "data": {"verb": "stop_browsing", "session_id": session_id},
            },
        ],
    }


def create_progress_card(
    screenshot: str = None,
    next_goal: str = None,
    action: str = None,
    history_facts: list[dict] = None,
) -> dict:
    """Create a progress card showing the current state of the browsing session.

    Args:
        screenshot: Base64 encoded screenshot
        next_goal: Next goal to be achieved
        action: Current action being performed
        history_facts: List of dictionaries containing history facts with format:
                      [{"thought": str, "goal": str, "action": str}, ...]
    """
    card = {
        "type": "AdaptiveCard",
        "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
        "version": "1.5",
        "body": [],
    }

    if screenshot:
        card["body"].append(
            {
                "type": "Image",
                "url": f"data:image/png;base64,{screenshot}",
                "msTeams": {
                    "allowExpand": True,
                },
            }
        )

    if next_goal:
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
                            "text": next_goal,
                            "wrap": True,
                        }
                    ],
                },
            ],
        }
        card["body"].append(progress_section)

    if action:
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
                            "text": action,
                            "wrap": True,
                        }
                    ],
                },
            ],
        }
        card["body"].append(status_section)

    if history_facts:
        facts = []
        for i, fact in enumerate(history_facts):
            facts.append(
                {
                    "title": f"Step {i+1}",
                    "value": f"🤔 Thought: {fact['thought']}\n"
                    f"🎯 Goal: {fact['goal']}\n"
                    f"⚡ Action: {fact['action']}",
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


def create_final_card(
    message: str, screenshot: str = None, override_title: str = None
) -> dict:
    """Create a final card showing the completion of the browsing session."""
    card = {
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
                        "text": override_title or "✨ Task Complete",
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

    if screenshot:
        card["body"].insert(
            1,
            {
                "type": "Image",
                "url": f"data:image/png;base64,{screenshot}",
                "msTeams": {
                    "allowExpand": True,
                },
            },
        )

    return card


def create_cua_progress_card(
    screenshot: str = None,
    current_step: dict = None,
    history: list[dict] = None,
    status: str = "Running",
) -> dict:
    """Create a progress card showing the current state of the computer use session.

    Args:
        screenshot: Base64 encoded screenshot
        current_step: Current step info with format:
                     {"action": str, "next_action": str, "message": str}
        history: List of previous steps with format:
                [{"action": str, "next_action": str, "message": str}, ...]
        status: Current status of the agent (Running/Paused)
    """
    card = {
        "type": "AdaptiveCard",
        "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
        "version": "1.5",
        "body": [
            {
                "type": "Container",
                "style": "emphasis",
                "items": [
                    {
                        "type": "ColumnSet",
                        "columns": [
                            {
                                "type": "Column",
                                "width": "stretch",
                                "items": [
                                    {
                                        "type": "TextBlock",
                                        "text": "🤖 Computer Use Agent",
                                        "weight": "Bolder",
                                        "size": "Large",
                                        "wrap": True,
                                    }
                                ],
                            },
                            {
                                "type": "Column",
                                "width": "auto",
                                "items": [
                                    {
                                        "type": "TextBlock",
                                        "text": f"Status: {status}",
                                        "weight": "Bolder",
                                        "wrap": True,
                                    }
                                ],
                            },
                            {
                                "type": "Column",
                                "width": "auto",
                                "items": [
                                    {
                                        "type": "ActionSet",
                                        "actions": [
                                            {
                                                "type": "Action.Submit",
                                                "title": (
                                                    "⏸️" if status == "Running" else "▶️"
                                                ),
                                                "data": {
                                                    "verb": "toggle_pause",
                                                    "current_status": status,
                                                },
                                            }
                                        ],
                                    }
                                ],
                            },
                        ],
                    }
                ],
            }
        ],
    }

    if screenshot:
        card["body"].append(
            {
                "type": "Image",
                "url": f"data:image/png;base64,{screenshot}",
                "msTeams": {
                    "allowExpand": True,
                },
            }
        )

    if current_step:
        current_section = {
            "type": "Container",
            "style": "default",
            "items": [
                {
                    "type": "TextBlock",
                    "text": "Current Step",
                    "weight": "Bolder",
                    "wrap": True,
                },
                {
                    "type": "FactSet",
                    "facts": [
                        {
                            "title": "Action",
                            "value": current_step.get("action", "No action"),
                        },
                        {
                            "title": "Next Action",
                            "value": current_step.get("next_action", "None"),
                        },
                    ],
                },
            ],
        }

        if current_step.get("message"):
            current_section["items"].append(
                {
                    "type": "TextBlock",
                    "text": current_step["message"],
                    "wrap": True,
                    "isSubtle": True,
                }
            )

        card["body"].append(current_section)

    if history:
        history_container = {
            "type": "Container",
            "style": "default",
            "isVisible": False,
            "id": "history_container",
            "items": [
                {
                    "type": "TextBlock",
                    "text": "History",
                    "weight": "Bolder",
                    "wrap": True,
                }
            ],
        }

        for i, step in enumerate(history):
            step_facts = [
                {
                    "title": "Action",
                    "value": step.get("action", "No action"),
                },
                {
                    "title": "Next Action",
                    "value": step.get("next_action", "None"),
                },
            ]

            if step.get("message"):
                step_facts.append(
                    {
                        "title": "Message",
                        "value": step["message"],
                    }
                )

            history_container["items"].append(
                {
                    "type": "Container",
                    "style": "emphasis",
                    "items": [
                        {
                            "type": "TextBlock",
                            "text": f"Step {i + 1}",
                            "weight": "Bolder",
                            "size": "Medium",
                            "wrap": True,
                        },
                        {
                            "type": "FactSet",
                            "facts": step_facts,
                        },
                    ],
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
                            "targetElements": ["history_container"],
                        }
                    ],
                },
                history_container,
            ]
        )

    return card


def create_safety_check_card(
    session_id: str, pending_safety_checks: list[PendingSafetyCheck]
) -> dict:
    """Create an adaptive card that shows pending safety checks with an approve all button.

    Args:
        pending_safety_checks: List of pending safety checks to display
    """
    safety_check_items = []
    for i, check in enumerate(pending_safety_checks, 1):
        safety_check_items.append(
            {"type": "TextBlock", "text": f"{i + 1}. {check.description}", "wrap": True}
        )

    return {
        "type": "AdaptiveCard",
        "$schema": "https://adaptivecards.io/schemas/adaptive-card.json",
        "version": "1.5",
        "body": [
            {
                "type": "TextBlock",
                "text": "Pending Safety Checks",
                "wrap": True,
                "style": "heading",
            },
            *safety_check_items,
            {
                "type": "ActionSet",
                "actions": [
                    {
                        "type": "Action.Submit",
                        "title": "Approve All",
                        "data": {
                            "verb": "approve_safety_check",
                            "session_id": session_id,
                        },
                    }
                ],
                "horizontalAlignment": "Right",
            },
        ],
    }
