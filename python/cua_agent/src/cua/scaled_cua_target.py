import io

import PIL
from openai.types.responses.function_tool_param import FunctionToolParam
from openai.types.responses.response_computer_tool_call import Action
from openai.types.responses.response_function_tool_call import ResponseFunctionToolCall

from cua.cua_target import CUATarget, Screenshot


class ScaledCUATarget(CUATarget):
    """Wrapper for a CUATarget instance that performs resizing and coordinate translation."""

    @property
    def environment(self) -> str:
        return self.target.environment

    def __init__(self, width, height, target: CUATarget):
        self.width = width
        self.height = height
        self.target = target
        self.screen_width = -1
        self.screen_height = -1

    async def take_screenshot(self) -> Screenshot:
        screenshot = await self.target.take_screenshot()
        return self._scale_screenshot(screenshot)

    async def handle_tool_call(
        self, action: Action | ResponseFunctionToolCall
    ) -> Screenshot | None:
        # If it's a custom action, pass it through directly
        if isinstance(action, ResponseFunctionToolCall):
            return await self.target.handle_tool_call(action)

        # For standard Action types, adjust coordinates and pass through
        self._adjust_action_args(action)
        tool_call_result = await self.target.handle_tool_call(action)
        if tool_call_result is None:
            return None
        if isinstance(tool_call_result, Screenshot):
            return self._scale_screenshot(tool_call_result)

    @property
    def additional_tool_schemas(self) -> list[FunctionToolParam]:
        return self.target.additional_tool_schemas

    def _adjust_action_args(self, action: Action) -> None:
        if action.type in ("click", "double_click", "move"):
            action.x, action.y = self._point_to_screen_coords(action.x, action.y)
        elif action.type == "drag":
            for point in action.path:
                x, y = self._point_to_screen_coords(point[0], point[1])
                point["x"] = x
                point["y"] = y

    def _scale_screenshot(self, screenshot: Screenshot) -> Screenshot:
        buffer = io.BytesIO(screenshot)
        image = PIL.Image.open(buffer)
        self.screen_width, self.screen_height = image.size
        ratio = min(self.width / self.screen_width, self.height / self.screen_height)
        new_width = int(self.screen_width * ratio)
        new_height = int(self.screen_height * ratio)
        resized_image = image.resize(
            (new_width, new_height), PIL.Image.Resampling.LANCZOS
        )
        image = PIL.Image.new("RGB", (self.width, self.height), (0, 0, 0))
        image.paste(resized_image, (0, 0))
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")
        buffer.seek(0)
        return Screenshot(buffer.getvalue())

    def _point_to_screen_coords(self, x, y):
        ratio = min(self.width / self.screen_width, self.height / self.screen_height)
        x = x / ratio
        y = y / ratio
        return int(x), int(y)
