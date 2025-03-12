import asyncio
import logging

from openai.types.responses.response_computer_tool_call import Action

from cua.cua_target import CUATarget, Screenshot
from cua.vnc.vnc import VNCMachine

logger = logging.getLogger(__name__)


class Machine(CUATarget):
    """Controls a remote computer by using VNC to take screenshots and perform actions."""

    @property
    def environment(self) -> str:
        return "linux"

    def __init__(self, width=1024, height=768, address=None, password=None):
        super().__init__(width, height)
        self.vnc = VNCMachine(address, password)

    async def take_screenshot(self) -> Screenshot:
        image_path = "screenshot.png"
        await self.vnc.screenshot(screenshot_name=image_path, keys=None)
        with open(image_path, "rb") as image_file:
            return Screenshot(image_file.read())

    async def _take_action(self, action: Action) -> Screenshot | None:
        if action.type == "click":
            await self.vnc.mouse_click(
                position=(action.x, action.y), action="click", button=1
            )
        elif action.type == "double_click":
            await self.vnc.mouse_click(
                position=(action.x, action.y),
                action="double_click",
                button=1,
            )
        elif action.type == "drag":
            await self.vnc.drag_mouse(
                path=[(point["x"], point["y"]) for point in action.path],
            )
        elif action.type == "keypress":
            await self.vnc.multi_key_press(
                keys=action.keys,
            )
        elif action.type == "move":
            await self.vnc.move_mouse(
                position=(action.x, action.y),
            )
        elif action.type == "scroll":
            await self.vnc.scroll(
                position=(action.x, action.y),
                horizontal=action.scroll_x,
                vertical=action.scroll_y,
            )
        elif action.type == "type":
            await self.vnc.type(
                text=action.text,
            )
        elif action.type == "wait":
            await asyncio.sleep(1)  # Default wait time of 1 second
        elif action.type == "screenshot":
            return await self.take_screenshot()
        else:
            raise ValueError(f"Invalid action: {action.type}")

    async def handle_tool_call(self, action: Action) -> Screenshot | None:
        logger.info("Taking action: %s", action)
        return await self._take_action(action)
