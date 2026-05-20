"""
@author: Azornes
@title: AzLogs
@version: 1.5.2
@description: Logging Initializator
"""
# ruff: noqa: T201
import os
import sys
import traceback
import logging

_logger = logging.getLogger(__name__)
LOG_MODULE_NAME = None
_default_module_name = __name__
_initialized = False
_project_root = None

try:
    from .logger import logger, LogLevel, debug, info, warn, error, exception
    from .config import LOG_LEVEL, LOG_MODULE_NAME, USE_COLORS

    def _find_project_root(start_path):
        current = os.path.dirname(os.path.abspath(start_path))
        while current:
            if os.path.isdir(os.path.join(current, ".git")):
                return current
            parent = os.path.dirname(current)
            if parent == current:
                break
            current = parent
        return os.path.dirname(os.path.dirname(os.path.abspath(start_path)))

    _project_root = _find_project_root(__file__)
    _default_module_name = (
        LOG_MODULE_NAME
        if LOG_MODULE_NAME is not None
        else os.path.basename(_project_root)
    )

    logger.set_global_level(LogLevel[LOG_LEVEL])

    logger.configure(
        {
            "log_to_file": True,
            "log_dir": os.path.join(os.path.dirname(os.path.abspath(__file__)), "logs"),
            "use_colors": (
                logger.config["use_colors"]
                if "AZLOGS_USE_COLORS" in os.environ
                else USE_COLORS
            ),
        }
    )

    _initialized = True
except ImportError as e:
    _initialized = False
    _logger.error(f"Failed to initialize logger: {e}")


def _normalize_module_name(module_name):
    module_name = str(module_name or "").strip()
    if not module_name:
        return _default_module_name

    normalized_path = module_name.replace("/", os.sep).replace("\\", os.sep)

    if os.path.isabs(normalized_path):
        path_no_ext = os.path.splitext(normalized_path)[0]
        if _project_root:
            try:
                relative_path = os.path.relpath(path_no_ext, _project_root)
            except ValueError:
                relative_path = os.path.basename(path_no_ext)
        else:
            relative_path = os.path.basename(path_no_ext)

        if relative_path.endswith("__init__"):
            relative_path = os.path.dirname(relative_path) or os.path.basename(
                os.path.dirname(path_no_ext)
            )

        cleaned = relative_path.replace(os.sep, ".").strip(".")
        return cleaned or _default_module_name

    if module_name == "__main__":
        return _default_module_name

    parts = [part for part in module_name.split(".") if part]
    if not parts:
        return _default_module_name

    if parts[-1] == "__init__":
        parts = parts[:-1]

    if LOG_MODULE_NAME and parts[0] == LOG_MODULE_NAME:
        parts = parts[1:]

    if "custom_nodes" in parts:
        parts = parts[parts.index("custom_nodes") + 2 :]

    if "comfyui-resolution-master" in parts:
        parts = parts[parts.index("comfyui-resolution-master") + 1 :]

    cleaned = ".".join(parts).strip(".")
    return cleaned or _default_module_name


def _normalize_module_path(file_path):
    if not file_path:
        return _default_module_name

    normalized_path = os.path.normpath(file_path)
    path_no_ext = os.path.splitext(normalized_path)[0]

    if _project_root:
        try:
            relative_path = os.path.relpath(path_no_ext, _project_root)
        except ValueError:
            relative_path = os.path.basename(path_no_ext)
    else:
        relative_path = os.path.basename(path_no_ext)

    parts = [part for part in relative_path.split(os.sep) if part]
    if not parts:
        return _default_module_name

    if parts[-1] == "__init__":
        parts = parts[:-1]

    package_name = LOG_MODULE_NAME or os.path.basename(_project_root or "")
    if package_name:
        parts.insert(0, package_name)

    cleaned = ".".join(parts).strip(".")
    return cleaned or _default_module_name


def _resolve_module_name(stack_depth=2):
    if not _initialized:
        return _normalize_module_name(LOG_MODULE_NAME or __name__)

    try:
        frame = sys._getframe(stack_depth)
    except ValueError:
        return _normalize_module_name(_default_module_name)

    file_path = frame.f_globals.get("__file__")
    if file_path:
        return _normalize_module_path(file_path)

    module_name = frame.f_globals.get("__name__")
    return _normalize_module_name(module_name)


class ModuleLogger:
    def __init__(self, module_name):
        self.module_name = module_name

    def debug(self, *args, **kwargs):
        if _initialized:
            kwargs.setdefault("stacklevel", 4)
            debug(self.module_name, *args, **kwargs)
        else:
            print(f"[DEBUG] [{self.module_name}]", *args)

    def info(self, *args, **kwargs):
        if _initialized:
            kwargs.setdefault("stacklevel", 4)
            info(self.module_name, *args, **kwargs)
        else:
            print(f"[INFO] [{self.module_name}]", *args)

    def warning(self, *args, **kwargs):
        if _initialized:
            kwargs.setdefault("stacklevel", 4)
            warn(self.module_name, *args, **kwargs)
        else:
            print(f"[WARN] [{self.module_name}]", *args)

    def warn(self, *args, **kwargs):
        self.warning(*args, **kwargs)

    def error(self, *args, **kwargs):
        if _initialized:
            kwargs.setdefault("stacklevel", 4)
            error(self.module_name, *args, **kwargs)
        else:
            print(f"[ERROR] [{self.module_name}]", *args)

    def exception(self, *args):
        if _initialized:
            exception(self.module_name, *args, stacklevel=4)
        else:
            print(f"[ERROR] [{self.module_name}]", *args)
            traceback.print_exc()


def create_module_logger(module_name=None):
    resolved_name = (
        _normalize_module_name(module_name)
        if module_name is not None
        else _resolve_module_name(stack_depth=2)
    )
    return ModuleLogger(resolved_name)


def log_debug(*args, **kwargs):
    module_name = _resolve_module_name(stack_depth=2)
    if _initialized:
        kwargs.setdefault("stacklevel", 4)
        debug(module_name, *args, **kwargs)
    else:
        print(f"[DEBUG] [{module_name}]", *args)


def log_info(*args, **kwargs):
    module_name = _resolve_module_name(stack_depth=2)
    if _initialized:
        kwargs.setdefault("stacklevel", 4)
        info(module_name, *args, **kwargs)
    else:
        print(f"[INFO] [{module_name}]", *args)


def log_warn(*args, **kwargs):
    module_name = _resolve_module_name(stack_depth=2)
    if _initialized:
        kwargs.setdefault("stacklevel", 4)
        warn(module_name, *args, **kwargs)
    else:
        print(f"[WARN] [{module_name}]", *args)


def log_error(*args, **kwargs):
    module_name = _resolve_module_name(stack_depth=2)
    if _initialized:
        kwargs.setdefault("stacklevel", 4)
        error(module_name, *args, **kwargs)
    else:
        print(f"[ERROR] [{module_name}]", *args)


def log_exception(*args):
    module_name = _resolve_module_name(stack_depth=2)
    if _initialized:
        exception(module_name, *args, stacklevel=4)
    else:
        print(f"[ERROR] [{module_name}]", *args)
        traceback.print_exc()
