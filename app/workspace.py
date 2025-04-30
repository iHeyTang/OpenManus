import os
from pathlib import Path
from typing import Union

from app.config import config
from app.exceptions import ToolError

PathLike = Union[str, Path]


def resolve_path(path: PathLike) -> Path:
    """
    Resolve path relative to base_path.

    Since the workspace filepath is a virtual path rather than a physical path on the host system,
    this function converts virtual paths to their corresponding physical paths before file operations
    are performed.
    """
    path_str = str(path).replace("\\", "/")

    if not path_str.startswith("/workspace"):
        raise ToolError(f"Path {path_str} is not a valid path")

    resolved = Path(config.workspace_root / path_str.replace("/workspace/", ""))
    if not resolved.parent.exists():
        os.makedirs(resolved.parent, exist_ok=True)
    return resolved
