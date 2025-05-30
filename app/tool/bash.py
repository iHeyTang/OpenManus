import asyncio

from app.exceptions import ToolError
from app.tool.base import BaseTool, CLIResult

_BASH_DESCRIPTION = """Execute a bash command in the terminal.
* Long running commands: For commands that may run indefinitely, it should be run in the background and the output should be redirected to a file, e.g. command = `python3 app.py > server.log 2>&1 &`.
* Interactive: If a bash command returns exit code `-1`, this means the process is not yet finished. The assistant must then send a second call to terminal with an empty `command` (which will retrieve any additional logs), or it can send additional text (set `command` to the text) to STDIN of the running process, or it can send command=`ctrl+c` to interrupt the process.
* Timeout: If a command execution result says "Command timed out. Sending SIGINT to the process", the assistant should retry running the command in the background.
"""


class Bash(BaseTool):
    """A tool for executing bash commands"""

    name: str = "bash"
    description: str = _BASH_DESCRIPTION
    parameters: dict = {
        "type": "object",
        "properties": {
            "command": {
                "type": "string",
                "description": "The bash command to execute. Can be empty to view additional logs when previous exit code is `-1`. Can be `ctrl+c` to interrupt the currently running process.",
            },
            "timeout": {
                "type": "integer",
                "description": "Timeout in seconds for the command execution. If not provided, the system will use the default value (300 seconds).",
            },
        },
        "required": ["command"],
    }

    async def execute(
        self, command: str | None = None, timeout: int | None = None
    ) -> CLIResult:
        if command is not None:
            return await self.sandbox.run_command(command, timeout=timeout or 300)

        raise ToolError("no command provided.")


if __name__ == "__main__":
    bash = Bash()
    rst = asyncio.run(bash.execute("ls -l"))
    print(rst)
