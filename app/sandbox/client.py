import asyncio
import os
from abc import ABC, abstractmethod
from typing import Dict, Optional

from app.config import SandboxSettings
from app.logger import logger
from app.sandbox.core.exceptions import SandboxNotFoundError
from app.sandbox.core.manager import SandboxManager as CoreSandboxManager
from app.sandbox.core.sandbox import DockerSandbox


class BaseSandboxClient(ABC):
    """Base sandbox client interface."""

    @abstractmethod
    async def create(
        self,
        config: Optional[SandboxSettings] = None,
        volume_bindings: Optional[Dict[str, str]] = None,
    ) -> None:
        """Creates sandbox."""

    @abstractmethod
    async def run_command(self, command: str, timeout: Optional[int] = None) -> str:
        """Executes command."""

    @abstractmethod
    async def copy_from(self, container_path: str, local_path: str) -> None:
        """Copies file from container."""

    @abstractmethod
    async def copy_to(self, local_path: str, container_path: str) -> None:
        """Copies file to container."""

    @abstractmethod
    async def read_file(self, path: str) -> str:
        """Reads file."""

    @abstractmethod
    async def write_file(self, path: str, content: str) -> None:
        """Writes file."""

    @abstractmethod
    async def cleanup(self) -> None:
        """Cleans up resources."""


class LocalSandboxClient(BaseSandboxClient):
    """Local sandbox client implementation."""

    def __init__(self):
        """Initializes local sandbox client."""
        self.sandbox: Optional[DockerSandbox] = None

    async def create(
        self,
        config: Optional[SandboxSettings] = None,
        volume_bindings: Optional[Dict[str, str]] = None,
    ) -> None:
        """Creates a sandbox.

        Args:
            config: Sandbox configuration.
            volume_bindings: Volume mappings.

        Raises:
            RuntimeError: If sandbox creation fails.
        """
        self.sandbox = DockerSandbox(config=config, volume_bindings=volume_bindings)
        await self.sandbox.create()

    async def run_command(self, command: str, timeout: Optional[int] = None) -> str:
        """Runs command in sandbox.

        Args:
            command: Command to execute.
            timeout: Execution timeout in seconds.

        Returns:
            Command output.

        Raises:
            RuntimeError: If sandbox not initialized.
        """
        if not self.sandbox:
            raise RuntimeError("Sandbox not initialized")
        return await self.sandbox.run_command(command, timeout)

    async def copy_from(self, container_path: str, local_path: str) -> None:
        """Copies file from container to local.

        Args:
            container_path: File path in container.
            local_path: Local destination path.

        Raises:
            RuntimeError: If sandbox not initialized.
        """
        if not self.sandbox:
            raise RuntimeError("Sandbox not initialized")
        await self.sandbox.copy_from(container_path, local_path)

    async def copy_to(self, local_path: str, container_path: str) -> None:
        """Copies file from local to container.

        Args:
            local_path: Local source file path.
            container_path: Destination path in container.

        Raises:
            RuntimeError: If sandbox not initialized.
        """
        if not self.sandbox:
            raise RuntimeError("Sandbox not initialized")
        await self.sandbox.copy_to(local_path, container_path)

    async def read_file(self, path: str) -> str:
        """Reads file from container.

        Args:
            path: File path in container.

        Returns:
            File content.

        Raises:
            RuntimeError: If sandbox not initialized.
        """
        if not self.sandbox:
            raise RuntimeError("Sandbox not initialized")
        return await self.sandbox.read_file(path)

    async def write_file(self, path: str, content: str) -> None:
        """Writes file to container.

        Args:
            path: File path in container.
            content: File content.

        Raises:
            RuntimeError: If sandbox not initialized.
        """
        if not self.sandbox:
            raise RuntimeError("Sandbox not initialized")
        await self.sandbox.write_file(path, content)

    async def cleanup(self) -> None:
        """Cleans up resources."""
        if self.sandbox:
            await self.sandbox.cleanup()
            self.sandbox = None


class SandBoxManager(CoreSandboxManager):
    """Sandbox manager"""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    async def create_sandbox(
        self,
        sandbox_id: str,
        host_workspace: str,
        default_working_directory: str,
    ) -> str:
        """ensure container exists, if not, create it"""

        # check if container exists
        try:
            c: DockerSandbox = await self.get_sandbox(sandbox_id)
        except SandboxNotFoundError:
            c = None

        if c != None:
            # container exists, start it if not running
            if c.container.status != "running" and c.container.status != "created":
                await asyncio.to_thread(c.container.start)

        # container not found, create new container
        logger.info(f"Creating new persistent container: {sandbox_id}")

        # prepare container config
        await super().create_sandbox(
            sandbox_id=sandbox_id,
            config=SandboxSettings(
                memory_limit="2g",
                cpu_limit=1.0,
                network_enabled=True,
                work_dir=default_working_directory,
            ),
            volume_bindings={
                f"{host_workspace}/.cache": "/root/.cache",
                f"{host_workspace}/.local": "/root/.local",
                f"{host_workspace}/.npm": "/root/.npm",
                f"{host_workspace}": "/workspace",
            },
            environment={
                "PYTHONUNBUFFERED": "1",
                "TERM": "dumb",
                "PS1": "$ ",
                "PROMPT_COMMAND": "",
                "UV_INDEX_URL": "https://mirrors.aliyun.com/pypi/simple/",
                "NPM_REGISTRY": "https://registry.npmmirror.com",
            },
            # pids_limit=100,
            # ulimits=[docker_types.Ulimit(name="nofile", soft=1024, hard=2048)],
            # read_only=True,
            # cap_drop=["ALL"],
            # security_opt=["no-new-privileges"],
            # tmpfs={"/tmp": "size=512m,mode=1777", "/var/run": "size=64m,mode=1777"},
        )


SANDBOX_MANAGER = SandBoxManager()
