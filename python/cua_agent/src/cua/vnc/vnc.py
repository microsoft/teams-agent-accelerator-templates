import logging
import math
import time
from contextlib import contextmanager
from typing import Any, Iterator, Literal

from vncdotool import api
from vncdotool.client import VNCDoToolClient


# Apply monkey patch to State.__getattr__ before importing vncdotool
def _monkey_patch_state_getattr():
    """
    Apply a patch to the State.__getattr__ method.
    """
    from teams.state.state import State

    def safe_getattr(self, key: str) -> Any:
        try:
            return self[key]
        except KeyError:
            raise AttributeError(
                f"'{self.__class__.__name__}' object has no attribute '{key}'"
            )

    # Replace the method
    State.__getattr__ = safe_getattr


# Initialize logger before using it in the patch function
logger = logging.getLogger(__name__)

# Apply the patch before importing vncdotool
_monkey_patch_state_getattr()

# https://github.com/sibson/vncdotool/blob/0.13/vncdotool/client.py#L21
CUA_KEY_TO_VNC_KEY: dict[str, str] = {
    "/": "fslash",
    "\\": "bslash",
    "alt": "alt",
    "arrowdown": "down",
    "arrowleft": "left",
    "arrowright": "right",
    "arrowup": "up",
    "backspace": "bsp",
    "capslock": "caplk",
    "cmd": "super",
    "ctrl": "ctrl",
    "delete": "delete",
    "end": "end",
    "enter": "enter",
    "esc": "esc",
    "home": "home",
    "insert": "ins",
    "option": "alt",
    "pagedown": "pgdn",
    "pageup": "pgup",
    "shift": "shift",
    "space": "spacebar",
    "super": "super",
    "tab": "tab",
    "win": "super",
}


def cua_key_to_vnc_key(key: str) -> str:
    """
    Maps from our standard key definition to the VNC key definition
    """
    key = key.lower()
    return CUA_KEY_TO_VNC_KEY.get(key) or key


class VNCMachine:
    def __init__(self, address: str, password: str = None) -> None:
        self.address = address
        self.mouse_last_position = None
        self.password = password
        self.cached_client = None
        self._api = None

    async def _get_vnc_client(self) -> Any:
        """
        Return the VNC client connected to this machine.
        """
        if self.cached_client:
            return self.cached_client
        try:
            logger.info(
                f"Connecting to vnc client with address: {self.address} and password: {self.password}"
            )
            self.cached_client = api.connect(self.address, password=self.password)
        except Exception as e:
            logger.error(f"Error connecting to VNC: {e}")
            raise e
        return self.cached_client

    async def type(self, text: str) -> None:
        client = await self._get_vnc_client()
        client.factory.force_caps = True
        for char in text:
            if char == "\n":
                client.keyPress("enter")
            elif char == "\t":
                client.keyPress("tab")
            else:
                client.keyPress(char)
            time.sleep(0.06)

    async def multi_key_press(self, keys: list[str]) -> None:
        client = await self._get_vnc_client()
        with self.hold_keys(client, keys):
            pass

    async def move_mouse(
        self,
        position: tuple[int, int],
        keys: list[str] | None = None,
    ) -> None:
        client = await self._get_vnc_client()
        with self.hold_keys(client, keys):
            self._move_mouse_internal(position, client, 0.0002)

    async def mouse_click(
        self,
        position: tuple[int, int],
        action: Literal["click", "double_click"],
        button: int = 1,
        keys: list[str] | None = None,
    ) -> None:
        client = await self._get_vnc_client()
        with self.hold_keys(client, keys):
            self._move_mouse_internal(position, client)
            time.sleep(0.05)  # wait for mouse to stabalize
            if action == "click":
                client.mousePress(button)
            elif action == "double_click":
                client.mousePress(1)
                time.sleep(0.05)
                client.mousePress(1)

    async def screenshot(
        self, keys: list[str] | None = None, screenshot_name="screenshot.png"
    ) -> None:
        client = await self._get_vnc_client()
        with self.hold_keys(client, keys or []):
            client.local_cursor = True
            client.captureScreen(screenshot_name)

    async def drag_mouse(
        self,
        path: list[tuple[int, int]],
        keys: list[str] | None = None,
    ) -> None:
        if not path or len(path) < 2:
            raise ValueError("At least two points are required for a multi-point drag.")

        client = await self._get_vnc_client()
        with self.hold_keys(client, keys):
            self._move_mouse_internal(path[0], client)

            time.sleep(0.05)
            client.mouseDown(1)
            time.sleep(0.05)

            for point in path[1:]:
                self._move_mouse_internal(point, client, delay=0.005)

            client.mouseUp(1)
            time.sleep(0.05)

    async def scroll(
        self,
        position: tuple[int, int],
        horizontal: int,
        vertical: int,
        keys: list[str] | None = None,
    ) -> None:
        x, y = position
        keys = keys or []

        client = await self._get_vnc_client()
        self._move_mouse_internal((x, y), client)

        # VNC mouse button constants - http://xahlee.info/linux/linux_x11_mouse_button_number.html
        BUTTON_SCROLL_UP = 4  # linux maapping to scroll up
        BUTTON_SCROLL_DOWN = 5  # linux maapping to scroll down

        with self.hold_keys(client, keys):
            if vertical != 0:
                direction = BUTTON_SCROLL_DOWN if vertical > 0 else BUTTON_SCROLL_UP
                self._scroll(abs(vertical), direction, client)

            if horizontal != 0:
                with self.hold_keys(client, ["shift"]):
                    direction = (
                        BUTTON_SCROLL_DOWN if horizontal > 0 else BUTTON_SCROLL_UP
                    )
                    self._scroll(abs(horizontal), direction, client)

    def _scroll(
        self,
        scroll_amount: int,
        direction: int,
        client: VNCDoToolClient,
        delay: float = 0.05,
        scroll_factor: float = 5.0,
    ) -> None:
        # Calculate number of scroll events
        num_events = max(int(abs(scroll_amount) / scroll_factor), 1)

        for _ in range(num_events):
            client.mousePress(direction)
            time.sleep(delay)

    def _move_mouse_internal(
        self,
        position: tuple[int, int],
        client: VNCDoToolClient,
        delay: float = 0.0002,
    ) -> None:
        if (
            not hasattr(self, "mouse_last_position") or self.mouse_last_position is None
        ):  # assuming some arbitrary initial position
            self.mouse_last_position = (100, 100)
        x1, y1 = self.mouse_last_position
        x2, y2 = position
        steps = max(int(math.hypot(x2 - x1, y2 - y1)), 1)
        for i in range(1, steps + 1):
            client.mouseMove(
                int(x1 + (x2 - x1) * i / steps), int(y1 + (y2 - y1) * i / steps)
            )
            time.sleep(delay)
        self.mouse_last_position = position
        time.sleep(0.05)  # Wait for the mouse to settle

    @staticmethod
    @contextmanager
    def hold_keys(
        client: VNCDoToolClient, keys: list[str] | None = None
    ) -> Iterator[None]:
        keys = keys or []
        client.factory.force_caps = True
        try:
            for key in keys:
                key = cua_key_to_vnc_key(key=key)
                client.keyDown(key)
            yield
        finally:
            for key in reversed(keys):
                key = cua_key_to_vnc_key(key=key)
                client.keyUp(key)
