import logging


class Colors:
    GREY = "\x1b[38;5;242m"  # Grey color code
    RESET = "\x1b[0m"


def get_logger(name: str, level: int = logging.INFO) -> logging.Logger:
    """Configure and return a logger instance.

    Args:
        name: Name of the logger (typically __name__ from the calling module)
        level: Logging level (default: logging.INFO)
    """
    logger = logging.getLogger(name)
    logger.setLevel(level)

    # Only add handler if logger doesn't already have handlers
    if not logger.handlers:
        handler = logging.StreamHandler()
        formatter = logging.Formatter(
            f"{Colors.GREY}%(asctime)s:%(name)s:%(levelname)s - %(message)s{Colors.RESET}"
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)

    return logger
