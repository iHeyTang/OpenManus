"""File operation interfaces and implementations."""

from typing import Literal, Optional, Tuple

from app.exceptions import ToolError
from app.tool.base import BaseTool, CLIResult, ToolResult
from app.workspace import PathLike

_FILE_OPERATOR_DESCRIPTION = """A tool for performing file operations.
Provides functionality for reading, writing, and checking file properties."""


class FileOperator(BaseTool):
    """File operations implementation"""

    name: str = "file_operator"
    description: str = _FILE_OPERATOR_DESCRIPTION
    parameters: dict = {
        "type": "object",
        "properties": {
            "command": {
                "type": "string",
                "description": "The file operation command to execute.",
                "enum": ["read", "write", "is_directory", "exists", "run_command"],
            },
            "path": {
                "type": "string",
                "description": "The path to the file or directory to operate on.",
            },
            "content": {
                "type": "string",
                "description": "The content to write to the file. Required for 'write' command.",
            },
            "cmd": {
                "type": "string",
                "description": "The command to run. Required for 'run_command' command.",
            },
            "timeout": {
                "type": "number",
                "description": "Timeout in seconds for command execution. Optional for 'run_command' command.",
            },
        },
        "required": ["command", "path"],
    }

    async def execute(
        self,
        *,
        command: Literal["read", "write", "is_directory", "exists", "run_command"],
        path: str,
        content: Optional[str] = None,
        cmd: Optional[str] = None,
        timeout: Optional[float] = None,
        **kwargs,
    ) -> ToolResult:
        """Execute a file operation command."""
        try:
            if command == "read":
                result = await self._read_file(path)
                return ToolResult(output=result)
            elif command == "write":
                if content is None:
                    raise ToolError(
                        "Parameter 'content' is required for 'write' command"
                    )
                await self._write_file(path, content)
                return ToolResult(output=f"Successfully wrote to {path}")
            elif command == "is_directory":
                result = await self._is_directory(path)
                return ToolResult(output=str(result))
            elif command == "exists":
                result = await self._exists(path)
                return ToolResult(output=str(result))
            elif command == "run_command":
                if cmd is None:
                    raise ToolError(
                        "Parameter 'cmd' is required for 'run_command' command"
                    )
                returncode, stdout, stderr = await self._run_command(cmd, timeout)
                return CLIResult(output=stdout, error=stderr)
            else:
                raise ToolError(f"Unrecognized command: {command}")
        except Exception as e:
            return ToolResult(error=str(e))

    async def _read_file(self, path: PathLike) -> str:
        """Read content from a file."""
        try:
            return await self.sandbox.read_file(str(path))
        except Exception as e:
            raise ToolError(f"Failed to read {path}: {str(e)}") from None

    async def _write_file(self, path: PathLike, content: str) -> None:
        """Write content to a file."""
        try:
            await self.sandbox.write_file(str(path), content)
        except Exception as e:
            raise ToolError(f"Failed to write to {path}: {str(e)}") from None

    async def _is_directory(self, path: PathLike) -> bool:
        """Check if path points to a directory."""
        result = await self.sandbox.run_command(
            f"test -d {path} && echo 'true' || echo 'false'"
        )
        return result.strip() == "true"

    async def _exists(self, path: PathLike) -> bool:
        """Check if path exists."""
        result = await self.sandbox.run_command(
            f"test -e {path} && echo 'true' || echo 'false'"
        )
        return result.strip() == "true"

    async def _run_command(
        self, cmd: str, timeout: Optional[float] = 120.0
    ) -> Tuple[int, str, str]:
        """Run a command."""
        try:
            stdout = await self.sandbox.run_command(
                cmd, timeout=int(timeout) if timeout else None
            )
            return (
                0,  # Always return 0 since we don't have explicit return code from sandbox
                stdout,
                "",  # No stderr capture in the current sandbox implementation
            )
        except TimeoutError as exc:
            raise TimeoutError(
                f"Command '{cmd}' timed out after {timeout} seconds"
            ) from exc
        except Exception as exc:
            return 1, "", f"Error executing command: {str(exc)}"
