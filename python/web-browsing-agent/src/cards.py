


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

        card["body"].extend([
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
        ])

    return card

def create_final_card(message: str, screenshot: str = None, override_title: str = None) -> dict:
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
