"""
AzLogs - Central logging system

Provides colored console logging, file rotation, and per-module log levels.
"""

from .logger import logger, LogLevel
from .log_funcs import create_module_logger

__all__ = [
    "logger",
    "LogLevel",
    "create_module_logger",
]
