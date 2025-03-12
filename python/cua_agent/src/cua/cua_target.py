from abc import ABC, abstractmethod

from openai.types.responses.response_computer_tool_call import Action


class Screenshot(bytes):
    """A screenshot is just bytes."""

    pass


class CUATarget(ABC):
    """Abstract base class for Computer Use Automation targets."""

    @property
    @abstractmethod
    def environment(self) -> str:
        """The environment of the target."""
        pass

    def __init__(self, width: int = 1024, height: int = 768):
        self.width = width
        self.height = height

    @abstractmethod
    async def take_screenshot(self) -> Screenshot:
        """Take a screenshot of the target and return the bytes."""
        pass

    @abstractmethod
    async def handle_tool_call(self, action: Action) -> Screenshot | None:
        """Handle a tool call and return the resulting screenshot."""
        pass
