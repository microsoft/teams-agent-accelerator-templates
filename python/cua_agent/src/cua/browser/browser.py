import asyncio
import logging

from openai.types.responses.response_computer_tool_call import Action
from playwright.sync_api import sync_playwright

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

    async def __aenter__(self):
        self.playwright = sync_playwright().start()
        self.browser = self.playwright.chromium.launch(
            headless=False,
            chromium_sandbox=True,
            env={},
            args=["--disable-extensions", "--disable-file-system"],
        )
        self.page = self.browser.new_page()
        self.page.set_viewport_size({"width": self.width, "height": self.height})
        self.page.goto("https://bing.com")
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.page:
            self.page.close()
        if self.context:
            self.context.close()
        if self.browser:
            self.browser.close()
        if self.playwright:
            self.playwright.stop()

    async def take_screenshot(self) -> Screenshot:
        screenshot = self.page.screenshot()
        return Screenshot(screenshot)

    async def _take_action(self, action: Action) -> Screenshot | None:
        if action.type == "click":
            self.page.mouse.click(action.x, action.y)
        elif action.type == "double_click":
            self.page.mouse.dblclick(action.x, action.y)
        elif action.type == "drag":
            path = action.path
            if not path:
                return
            self.page.mouse.move(path[0]["x"], path[0]["y"])
            self.page.mouse.down()
            for point in path[1:]:
                self.page.mouse.move(point["x"], point["y"])
            self.page.mouse.up()
        elif action.type == "keypress":
            for key in action.keys:
                self.page.keyboard.press(cua_key_to_playwright_key(key))
        elif action.type == "move":
            self.page.mouse.move(action.x, action.y)
        elif action.type == "scroll":
            self.page.mouse.move(action.x, action.y)
            self.page.mouse.wheel(action.scroll_x, action.scroll_y)
        elif action.type == "type":
            self.page.keyboard.type(action.text)
        elif action.type == "wait":
            await asyncio.sleep(1)  # Keep this async for the wait action
        elif action.type == "screenshot":
            return await self.take_screenshot()
        else:
            raise ValueError(f"Invalid action: {action.type}")

    async def handle_tool_call(self, action: Action) -> Screenshot | None:
        logger.info("Taking action: %s", action)
        return await self._take_action(action)

    async def navigate(self, url: str):
        """Navigate to a specific URL."""
        self.page.goto(url)
