from contextlib import AsyncExitStack
from typing import Any, Dict, List, Optional

from mcp import ClientSession, StdioServerParameters
from mcp.client.sse import sse_client
from mcp.client.stdio import stdio_client
from mcp.types import TextContent

from app.config import config
from app.logger import logger
from app.sandbox.client import SANDBOX_MANAGER
from app.sandbox.core.sandbox import DockerSandbox
from app.tool.base import BaseTool, ToolResult
from app.tool.tool_collection import ToolCollection


class MCPToolCallHost:
    """
    A context manager for handling multiple MCP client connections.
    A host is a MCPToolCallSandboxHost which contains multiple MCP clients.

    This class is responsible for:
    1. Maintaining multiple MCP client connections
    2. Managing client lifecycles
    3. Providing CRUD operations for clients
    4. Managing sandbox containers for all clients
    """

    def __init__(self, task_id: str, sandbox: DockerSandbox):
        self.task_id = task_id
        self.clients: Dict[str, MCPSandboxClients] = {}
        self.containers: Dict[str, bool] = {}  # key: container_name, value: is_created
        self.sandbox: DockerSandbox = sandbox

    async def add_sse_client(
        self, client_id: str, url: str, headers: Optional[dict[str, Any]] = None
    ) -> "MCPSandboxClients":
        """Add a new SSE-based MCP client connection running in a sandbox.

        Args:
            client_id: Unique identifier for the client
            url: URL of the MCP server
            headers: Headers to send to the MCP server

        Returns:
            MCPSandboxClients: The newly created sandboxed client instance

        Raises:
            ValueError: If client_id already exists
        """
        if client_id in self.clients:
            raise ValueError(f"Client ID '{client_id}' already exists")

        client = await MCPSandboxClients.connect_sse(
            client_id=client_id,
            host=self,
            server_url=url,
            headers=headers,
        )
        self.clients[client_id] = client
        return client

    async def add_stdio_client(
        self,
        client_id: str,
        command: str,
        args: Optional[List[str]] = None,
        env: Optional[Dict[str, str]] = None,
    ) -> "MCPSandboxClients":
        """Add a new STDIO-based MCP client connection running in a sandbox.

        Args:
            client_id: Unique identifier for the client
            command: Command to execute
            args: List of command arguments
            env: Environment variables

        Returns:
            MCPSandboxClients: The newly created sandboxed client instance

        Raises:
            ValueError: If client_id already exists
        """
        if client_id in self.clients:
            raise ValueError(f"Client ID '{client_id}' already exists")

        client = await MCPSandboxClients.connect_stdio(
            client_id=client_id,
            host=self,
            command=command,
            args=args or [],
            env=env or {},
        )
        self.clients[client_id] = client
        return client

    def get_client(self, client_id: str) -> Optional["MCPSandboxClients"]:
        """Retrieve a specific MCP client.

        Args:
            client_id: Unique identifier for the client

        Returns:
            Optional[Union[MCPClients, MCPSandboxClients]]: The client instance if found, None otherwise
        """
        return self.clients.get(client_id)

    async def remove_client(self, client_id: str) -> bool:
        """Remove and disconnect a specific MCP client connection.

        Args:
            client_id: Unique identifier for the client

        Returns:
            bool: True if client was found and removed, False otherwise
        """
        if client := self.clients.pop(client_id, None):
            await client.disconnect()
            return True
        return False

    async def disconnect_all(self) -> None:
        """Disconnect all MCP client connections and cleanup all containers."""
        client_ids = list(self.clients.keys())
        # If the list is not reversed, there would be error when disconnecting the client.
        # such like `Attempted to exit a cancel scope that isn't the current tasks's current cancel scope`
        # I don't know why should reverse the list, but it works,
        # if you know the reason, please let me know. Thanks!
        # by author @iheytang
        client_ids.reverse()
        for client_id in client_ids:
            await self.remove_client(client_id)

    async def cleanup(self) -> None:
        """Cleanup all containers."""
        await self.disconnect_all()

    def list_clients(self) -> List[str]:
        """Get a list of all client IDs.

        Returns:
            List[str]: List of all connected client IDs
        """
        return list(self.clients.keys())

    def get_client_count(self) -> int:
        """Get the current number of connected clients.

        Returns:
            int: Number of clients
        """
        return len(self.clients)


class MCPSandboxClients(ToolCollection):
    """
    A collection of tools that connects to an MCP server within a container and manages available tools.
    A client is a ToolCollection which contains multiple MCP tools.
    """

    name: str
    command_type: Optional[str] = None
    container_name: Optional[str] = None
    session: Optional[ClientSession] = None
    exit_stack: AsyncExitStack = None
    description: str = "MCP client tools running in container for server interaction"
    client_id: str = ""
    host: "MCPToolCallHost" = None

    def __new__(cls, *args, **kwargs):
        """Prevent direct instantiation of MCPSandboxClients."""
        raise TypeError(
            "MCPSandboxClients cannot be instantiated directly. Please use MCPSandboxClients.connect_sse() or MCPSandboxClients.connect_stdio() instead."
        )

    def __init__(self, client_id: str, host: "MCPToolCallHost"):
        super().__init__()
        self.name = f"mcp-{client_id}"
        self.client_id = client_id
        self.exit_stack = AsyncExitStack()
        self.host = host

    @classmethod
    async def connect_stdio(
        cls,
        client_id: str,
        host: "MCPToolCallHost",
        command: str,
        args: List[str],
        env: Dict[str, str],
    ) -> "MCPSandboxClients":
        """Connect to an MCP server using stdio transport within a container."""
        inst = object.__new__(cls)
        inst.__init__(client_id=client_id, host=host)
        inst.command_type = get_command_type(command)
        inst.container_name = inst.get_container_name()

        if not command:
            raise ValueError("Server command is required.")
        if inst.session:
            await inst.disconnect()

        # Convert to unified docker command parameters
        server_params = inst._convert_to_docker_command(
            StdioServerParameters(command=command, args=args, env=env)
        )
        # Use stdio_client provided by mcp library
        try:
            s = await inst.exit_stack.enter_async_context(stdio_client(server_params))
            inst.session = await inst.exit_stack.enter_async_context(ClientSession(*s))
        except Exception as e:
            logger.error(f"Error creating stdio client {inst.client_id}: {e}")
            raise

        # Directly call the initialization method
        await inst._initialize_and_list_tools()
        return inst

    @classmethod
    async def connect_sse(
        cls,
        client_id: str,
        host: "MCPToolCallHost",
        server_url: str,
        headers: Optional[dict[str, Any]] = None,
    ) -> "MCPSandboxClients":
        """Connect to an MCP server using SSE transport."""
        inst = object.__new__(cls)
        inst.__init__(client_id=client_id, host=host)

        if not server_url:
            raise ValueError("Server URL is required.")
        if inst.session:
            await inst.disconnect()

        # Use AsyncExitStack to manage async context
        try:
            s = await inst.exit_stack.enter_async_context(
                sse_client(url=server_url, headers=headers)
            )
            inst.session = await inst.exit_stack.enter_async_context(ClientSession(*s))
        except Exception as e:
            logger.error(f"Error creating sse client {inst.client_id}: {e}")
            raise

        # Fetch available tools from MCP server
        await inst._initialize_and_list_tools()
        return inst

    async def disconnect(self) -> None:
        """Disconnect from the MCP server and clean up resources."""
        if self.session and self.exit_stack:
            await self.exit_stack.aclose()
            self.session = None
            self.tools = tuple()
            self.tool_map = {}
            if self.container_name != self.host.sandbox.id:
                await SANDBOX_MANAGER.delete_sandbox(self.host.sandbox.id)

    async def _initialize_and_list_tools(self) -> None:
        """Initialize session and populate tool map."""
        if not self.session:
            raise RuntimeError("Session not initialized.")

        logger.info("Initializing MCP session...")
        try:
            await self.session.initialize()
            logger.info("MCP session initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize MCP session: {e}")
            await self.disconnect()
            raise RuntimeError(f"Failed to initialize MCP session: {e}")

        logger.info("Fetching available tools from MCP server...")
        try:
            response = await self.session.list_tools()
            logger.info(f"Received tool list response: {response}")

            # Clear existing tools
            self.tools = tuple()
            self.tool_map = {}

            # Add client_id prefix to tool name
            for tool in response.tools:
                prefixed_name = f"{self.client_id}-{tool.name}"
                server_tool = MCPSandboxClientTool(
                    name=prefixed_name,
                    description=tool.description,
                    parameters=tool.inputSchema,
                    session=self.session,
                    client_id=self.client_id,
                )
                self.tool_map[prefixed_name] = server_tool
                logger.info(f"Added tool: {prefixed_name}")

            self.tools = tuple(self.tool_map.values())
            logger.info(
                f"Connected to server with tools (via container): {[tool.name for tool in response.tools]}"
            )
        except Exception as e:
            logger.error(f"Failed to list tools: {e}")
            await self.disconnect()
            raise RuntimeError(f"Failed to list tools: {e}")

    def _convert_to_docker_command(
        self, parameters: StdioServerParameters
    ) -> StdioServerParameters:
        """Convert any command to unified docker command format and return StdioServerParameters.

        Args:
            parameters: The original command parameters

        Returns:
            StdioServerParameters: Parameters for stdio transport
        """
        command_type = get_command_type(parameters.command)

        # for docker command, keep original implementation
        if command_type == "docker":
            docker_command = "docker"
            docker_args = ["run"]

            if "--rm" not in parameters.args:
                docker_args.append("--rm")
            if "-i" not in parameters.args:
                docker_args.append("-i")

            docker_args.extend(["-v", f"{config.host_workspace_root}:/workspace"])
            docker_args.extend([parameters.command, *parameters.args])
            docker_args.extend([f"--name={self.host.sandbox.id}"])

            return StdioServerParameters(
                command=docker_command,
                args=docker_args,
                env=parameters.env,
            )

        docker_command = "docker"
        docker_args = ["exec"]

        if parameters.env:
            for key, value in parameters.env.items():
                docker_args.extend(["-e", f"{key}={value}"])

        docker_args.extend(["-i", self.host.sandbox.id])
        docker_args.extend(
            ["bash", "-c", " ".join([parameters.command, *parameters.args])]
        )
        print(f"docker_args: {' '.join(docker_args)}")
        return StdioServerParameters(
            command=docker_command,
            args=docker_args,
        )

    def get_container_name(self) -> str:
        """get container name"""
        if self.command_type == "docker":
            return f"{self.host.sandbox.id}-{self.client_id}"
        else:
            return self.host.sandbox.id


class MCPSandboxClientTool(BaseTool):
    """
    Represents a tool proxy that can be called on the MCP server from the client side.
    A client is a ToolCollection which contains multiple MCP tools.
    """

    session: Optional[ClientSession] = None
    client_id: str = ""

    async def execute(self, **kwargs) -> ToolResult:
        """Execute the tool by making a remote call to the MCP server."""
        if not self.session:
            return ToolResult(error="Not connected to MCP server")

        try:
            # Remove client_id prefix from tool name before calling server
            server_tool_name = (
                self.name[len(self.client_id) + 1 :] if self.client_id else self.name
            )
            result = await self.session.call_tool(server_tool_name, kwargs)
            content_str = ", ".join(
                item.text for item in result.content if isinstance(item, TextContent)
            )
            return ToolResult(output=content_str or "No output returned.")
        except Exception as e:
            return ToolResult(error=f"Error executing tool: {str(e)}")


def get_command_type(command: str) -> str:
    """Determine the type of command (uvx/npx/docker)."""
    if command.startswith("uvx"):
        return "uvx"
    elif command.startswith("npx"):
        return "npx"
    elif command.startswith("deno"):
        return "deno"
    elif command.startswith("docker"):
        return "docker"
    else:
        raise ValueError(f"Unsupported command type: {command}")
