import asyncio
import json
import logging

from openai.types.responses.function_tool_param import FunctionToolParam
from openai.types.responses.response_computer_tool_call import Action
from openai.types.responses.response_function_tool_call import ResponseFunctionToolCall
from playwright.async_api import async_playwright

from cua.cua_target import CUATarget, Screenshot

logger = logging.getLogger(__name__)

# Mapping for special keys to Playwright format
CUA_KEY_TO_PLAYWRIGHT_KEY = {
    "ENTER": "Enter",
    "TAB": "Tab",
    "SPACE": " ",
    "BACKSPACE": "Backspace",
    "DELETE": "Delete",
    "ESC": "Escape",
    "ESCAPE": "Escape",
    "UP": "ArrowUp",
    "DOWN": "ArrowDown",
    "LEFT": "ArrowLeft",
    "RIGHT": "ArrowRight",
    "HOME": "Home",
    "END": "End",
    "PAGEUP": "PageUp",
    "PAGEDOWN": "PageDown",
    "CTRL": "Control",
    "ALT": "Alt",
    "SHIFT": "Shift",
    "META": "Meta",
    "CAPSLOCK": "CapsLock",
    "F1": "F1",
    "F2": "F2",
    "F3": "F3",
    "F4": "F4",
    "F5": "F5",
    "F6": "F6",
    "F7": "F7",
    "F8": "F8",
    "F9": "F9",
    "F10": "F10",
    "F11": "F11",
    "F12": "F12",
}


def cua_key_to_playwright_key(key: str) -> str:
    """Convert CUA key format to Playwright key format."""
    if not key:
        return key
    upper_key = key.upper()
    if upper_key in CUA_KEY_TO_PLAYWRIGHT_KEY:
        return CUA_KEY_TO_PLAYWRIGHT_KEY[upper_key]
    return key


class Browser(CUATarget):
    """Controls a browser using Playwright to take screenshots and perform actions."""

    @property
    def environment(self) -> str:
        return "browser"

    def __init__(self, width=1024, height=768):
        super().__init__(width, height)
        self.playwright = None
        self.browser = None
        self.context = None
        self.page = None

    async def initialize(self):
        if self.browser is not None and self.page is not None:
            # If we already have a fully initialized browser instance, just return
            return

        if self.playwright is None:
            self.playwright = await async_playwright().start()

        if self.browser is None:
            self.browser = await self.playwright.chromium.launch(
                headless=False,
                chromium_sandbox=True,
                env={},
                args=["--disable-extensions", "--disable-file-system"],
            )

        if self.context is None:
            self.context = await self.browser.new_context()

        if self.page is None:
            self.page = await self.context.new_page()
            await self.page.set_viewport_size(
                {"width": self.width, "height": self.height}
            )
            await self.page.goto(
                "https://bing.com", wait_until="domcontentloaded", timeout=60000
            )
            await self._setup_popup_handler()

    async def _setup_popup_handler(self):
        """Set up event listener for popups."""

        async def handle_popup(popup):
            logger.info("New popup detected, switching to it")
            await popup.wait_for_load_state("domcontentloaded")
            self.page = popup
            logger.info(f"Switched to popup with title: {await popup.title()}")
            await self._setup_popup_handler()

        self.page.on("popup", handle_popup)

    async def set_auto_switch_to_popup(self, enabled: bool):
        """Enable or disable automatic switching to popups."""
        self.auto_switch_to_popup = enabled
        if enabled and self.page:
            await self._setup_popup_handler()

    async def cleanup(self):
        """Clean up browser resources."""
        if self.browser:
            await self.browser.close()
            self.browser = None
        if self.playwright:
            await self.playwright.stop()
            self.playwright = None
        self.context = None
        self.page = None

    async def take_screenshot(self) -> Screenshot:
        return await self._screenshot_and_save("screenshot.png")

    async def _screenshot_and_save(self, screenshot_name: str) -> Screenshot:
        screenshot = await self.page.screenshot()
        with open(screenshot_name, "wb") as f:
            f.write(screenshot)
        return Screenshot(screenshot)

    async def _take_action(self, action: Action) -> Screenshot | None:
        if action.type == "click":
            await self.page.mouse.click(action.x, action.y)
        elif action.type == "double_click":
            await self.page.mouse.dblclick(action.x, action.y)
        elif action.type == "drag":
            path = action.path
            if not path:
                return
            await self.page.mouse.move(path[0]["x"], path[0]["y"])
            await self.page.mouse.down()
            for point in path[1:]:
                await self.page.mouse.move(point["x"], point["y"])
            await self.page.mouse.up()
        elif action.type == "keypress":
            for key in action.keys:
                await self.page.keyboard.press(cua_key_to_playwright_key(key))
        elif action.type == "move":
            await self.page.mouse.move(action.x, action.y)
        elif action.type == "scroll":
            await self.page.mouse.move(action.x, action.y)
            await self.page.mouse.wheel(action.scroll_x, action.scroll_y)
        elif action.type == "type":
            await self.page.keyboard.type(action.text)
        elif action.type == "wait":
            await asyncio.sleep(1)  # Keep this async for the wait action
        elif action.type == "screenshot":
            return await self.take_screenshot()
        else:
            raise ValueError(f"Invalid action: {action.type}")

    async def handle_tool_call(
        self, action: Action | ResponseFunctionToolCall
    ) -> Screenshot | str | None:
        logger.info("Taking action: %s", action)
        if isinstance(action, ResponseFunctionToolCall):
            args = json.loads(action.arguments)
            if action.name == "navigate":
                await self.navigate(args["url"])
                return "Done!"
            elif action.name == "go_back":
                await self.go_back()
                return "Done!"
            raise ValueError("Browser does not support additional action types")
        return await self._take_action(action)

    async def navigate(self, url: str):
        """Navigate to a specific URL."""
        await self.page.goto(url, wait_until="domcontentloaded", timeout=30000)

    async def go_back(self):
        """Go back to the previous page."""
        await self.page.go_back()

    @property
    def additional_tool_schemas(self) -> list[FunctionToolParam]:
        return [
            FunctionToolParam(
                name="navigate",
                type="function",
                description="Navigate to a specific URL.",
                parameters={
                    "type": "object",
                    "properties": {
                        "url": {
                            "type": "string",
                            "description": "The URL to navigate to.",
                        },
                    },
                },
            ),
            FunctionToolParam(
                name="go_back",
                type="function",
                description="Go back to the previous page.",
                parameters={},
            ),
        ]
