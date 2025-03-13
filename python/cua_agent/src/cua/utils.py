import asyncio
import logging
from typing import Awaitable, Callable, Optional, TypeVar

logger = logging.getLogger(__name__)


class MaxRetriesExceeded(Exception):
    """Exception raised when maximum retry attempts have been exceeded."""

    def __init__(self, max_retries: int, last_result: any):
        self.max_retries = max_retries
        self.last_result = last_result
        super().__init__(f"Maximum retry attempts ({max_retries}) exceeded")


# Define a generic type variable for the return type of the operation
T = TypeVar("T")


async def retry_async_operation(
    operation: Callable[[], Awaitable[T]],
    max_retries: int = 3,
    check_result: Optional[Callable[[T], bool]] = None,
    retry_delay: float = 0,
) -> T:
    """
    Generic retry function for async operations.

    Args:
        operation: An async callable to execute
        max_retries: Maximum number of retry attempts
        check_result: Optional function to validate the result and determine if retry is needed
                     Should return True if result is valid, False if retry is needed
        retry_delay: Optional delay between retries in seconds

    Returns:
        The result of the operation with its original type preserved

    Raises:
        MaxRetriesExceeded: When the maximum number of retries is reached without a successful result
    """
    retry_count = 0

    while retry_count < max_retries:
        result = await operation()

        # If no check function provided or check passes, return the result
        if check_result is None or check_result(result):
            return result

        # Otherwise, increment retry count and try again
        retry_count += 1
        logger.warning(
            f"Operation failed check, retrying ({retry_count}/{max_retries})..."
        )

        if retry_delay > 0:
            await asyncio.sleep(retry_delay)

        if retry_count >= max_retries:
            logger.error("Max retries reached")
            raise MaxRetriesExceeded(max_retries, result)

    # This line should never be reached due to the exception above
    # but keeping it for type safety
    return result
