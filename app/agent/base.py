import uuid
from abc import ABC, abstractmethod
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, PrivateAttr, model_validator

from app.config import config
from app.llm import LLM
from app.logger import logger
from app.memory import Memory
from app.sandbox.client import SANDBOX_MANAGER
from app.sandbox.core.sandbox import DockerSandbox
from app.schema import ROLE_TYPE, AgentState, Message
from app.utils.agent_event import BaseAgentEvents, EventHandler, EventItem, EventQueue


class BaseAgent(BaseModel, ABC):
    """Abstract base class for managing agent state and execution.

    Provides foundational functionality for state transitions, memory management,
    and a step-based execution loop. Subclasses must implement the `step` method.
    """

    enable_event_queue: bool = Field(default=True, description="Enable event queue")
    _private_event_queue: EventQueue = PrivateAttr(default_factory=EventQueue)

    # Core attributes
    name: str = Field(..., description="Unique name of the agent")
    description: Optional[str] = Field(None, description="Optional agent description")

    should_plan: bool = Field(
        default=True, description="Whether the agent should plan before steps"
    )

    # Prompts
    system_prompt: Optional[str] = Field(
        None, description="System-level instruction prompt"
    )
    next_step_prompt: Optional[str] = Field(
        None, description="Prompt for determining next action"
    )

    task_id: Optional[str] = Field(None, description="Task ID for the agent")

    # Dependencies
    llm: LLM = Field(default_factory=LLM, description="Language model instance")
    memory: Memory = Field(default_factory=Memory, description="Agent's memory store")
    state: AgentState = Field(
        default=AgentState.IDLE, description="Current agent state"
    )

    sandbox: Optional[DockerSandbox] = Field(None, description="Sandbox instance")

    should_terminate: bool = Field(default=False, description="Terminate the agent")

    # Execution control
    max_steps: int = Field(default=10, description="Maximum steps before termination")
    current_step: int = Field(default=0, description="Current step in execution")

    duplicate_threshold: int = 2

    class Config:
        arbitrary_types_allowed = True
        extra = "allow"  # Allow extra fields for flexibility in subclasses

    @model_validator(mode="after")
    def initialize_agent(self) -> "BaseAgent":
        """Initialize agent with default settings if not provided."""
        if self.llm is None or not isinstance(self.llm, LLM):
            self.llm = LLM(config_name=self.name.lower())
        if not isinstance(self.memory, Memory):
            self.memory = Memory()
        if not isinstance(self.memory.llm, LLM):
            self.memory.llm = self.llm

        # Initialize private attributes
        if self.enable_event_queue:
            self._private_event_queue.start()
        return self

    def __del__(self):
        if hasattr(self, "_private_event_queue"):
            self._private_event_queue.stop()

    @asynccontextmanager
    async def state_context(self, new_state: AgentState):
        """Context manager for safe agent state transitions.

        Args:
            new_state: The state to transition to during the context.

        Yields:
            None: Allows execution within the new state.

        Raises:
            ValueError: If the new_state is invalid.
        """
        if not isinstance(new_state, AgentState):
            raise ValueError(f"Invalid state: {new_state}")

        previous_state = self.state
        self.state = new_state
        try:
            self.emit(
                BaseAgentEvents.STATE_CHANGE,
                {"old_state": previous_state.value, "new_state": self.state.value},
            )
            yield
        except Exception as e:
            self.state = AgentState.ERROR  # Transition to ERROR on failure
            self.emit(
                BaseAgentEvents.STATE_CHANGE,
                {"old_state": self.state.value, "new_state": AgentState.ERROR.value},
            )
            raise e
        finally:
            self.state = previous_state  # Revert to previous state
            self.emit(
                BaseAgentEvents.STATE_CHANGE,
                {"old_state": self.state.value, "new_state": previous_state.value},
            )

    async def update_memory(
        self,
        role: ROLE_TYPE,  # type: ignore
        content: str,
        base64_image: Optional[str] = None,
        **kwargs,
    ) -> None:
        """Add a message to the agent's memory.

        Args:
            role: The role of the message sender (user, system, assistant, tool).
            content: The message content.
            base64_image: Optional base64 encoded image.
            **kwargs: Additional arguments (e.g., tool_call_id for tool messages).

        Raises:
            ValueError: If the role is unsupported.
        """
        message_map = {
            "user": Message.user_message,
            "system": Message.system_message,
            "assistant": Message.assistant_message,
            "tool": lambda content, **kw: Message.tool_message(content, **kw),
        }

        if role not in message_map:
            raise ValueError(f"Unsupported message role: {role}")

        # Create message with appropriate parameters based on role
        if role == "assistant":
            kwargs = {"base64_image": base64_image}
        elif role == "tool":
            kwargs = {"base64_image": base64_image, **kwargs}
        message: Message = message_map[role](content, **kwargs)
        logger.info(f"Adding message to memory: {message}")
        await self.memory.add_message(message)
        self.emit(
            BaseAgentEvents.MEMORY_ADDED, {"role": role, "message": message.to_dict()}
        )

    async def prepare(self) -> None:
        """Prepare the agent for execution."""
        if not isinstance(self.sandbox, DockerSandbox):
            orgnization_id, task_id = self.task_id.split("/")
            sandbox_id = f"openmanus-sandbox-{orgnization_id}-{task_id}"
            host_workspace_root = str(f"{config.host_workspace_root}/{orgnization_id}")

            await SANDBOX_MANAGER.create_sandbox(
                sandbox_id=sandbox_id,
                host_workspace=host_workspace_root,
                default_working_directory=f"/workspace/{task_id}",
            )
            self.sandbox = await SANDBOX_MANAGER.get_sandbox(sandbox_id)

    async def plan(self) -> str:
        """Plan the agent's actions for the given request."""
        return ""

    async def run(self, request: Optional[str] = None) -> str:
        """Execute the agent's main loop asynchronously.

        Args:
            request: Optional initial user request to process.

        Returns:
            A string summarizing the execution results.

        Raises:
            RuntimeError: If the agent is not in IDLE state at start.
        """
        if self.state != AgentState.IDLE:
            raise RuntimeError(f"Cannot run agent from state: {self.state}")

        self.emit(BaseAgentEvents.LIFECYCLE_START, {"request": request})

        results: List[str] = []
        self.emit(BaseAgentEvents.LIFECYCLE_PREPARE_START, {})
        await self.prepare()
        self.emit(BaseAgentEvents.LIFECYCLE_PREPARE_COMPLETE, {})
        async with self.state_context(AgentState.RUNNING):
            if request:
                await self.update_memory("user", request)
                if self.should_plan:
                    await self.plan()

            while (
                self.current_step < self.max_steps and self.state != AgentState.FINISHED
            ):
                self.current_step += 1
                logger.info(f"Executing step {self.current_step}/{self.max_steps}")

                try:
                    step_result = await self.step()
                except Exception as e:
                    raise

                # Check for stuck state
                if self.is_stuck():
                    self.emit(BaseAgentEvents.STATE_STUCK_DETECTED, {})
                    self.handle_stuck_state()

                results.append(f"Step {self.current_step}: {step_result}")

                if self.should_terminate:
                    self.state = AgentState.FINISHED

            if self.current_step >= self.max_steps:
                self.current_step = 0
                self.state = AgentState.IDLE
                self.emit(
                    BaseAgentEvents.STEP_MAX_REACHED, {"max_steps": self.max_steps}
                )
                results.append(f"Terminated: Reached max steps ({self.max_steps})")

        if self.should_terminate:
            self.emit(
                BaseAgentEvents.LIFECYCLE_TERMINATED,
                {
                    "total_input_tokens": self.llm.total_input_tokens,
                    "total_completion_tokens": self.llm.total_completion_tokens,
                },
            )
        else:
            self.emit(
                BaseAgentEvents.LIFECYCLE_COMPLETE,
                {
                    "results": results,
                    "total_input_tokens": self.llm.total_input_tokens,
                    "total_completion_tokens": self.llm.total_completion_tokens,
                },
            )
        return "\n".join(results) if results else "No steps executed"

    @abstractmethod
    async def step(self) -> str:
        """Execute a single step in the agent's workflow.

        Must be implemented by subclasses to define specific behavior.

        Events emitted:
        - step:before: Before step execution
        - step:after: After successful step execution
        - step:error: On step execution error
        """

    def handle_stuck_state(self):
        """Handle stuck state by adding a prompt to change strategy"""
        stuck_prompt = "\
        Observed duplicate responses. Consider new strategies and avoid repeating ineffective paths already attempted."
        self.next_step_prompt = f"{stuck_prompt}\n{self.next_step_prompt}"
        logger.warning(f"Agent detected stuck state. Added prompt: {stuck_prompt}")

        self.emit(
            BaseAgentEvents.STATE_STUCK_HANDLED, {"new_prompt": self.next_step_prompt}
        )

    def is_stuck(self) -> bool:
        """Check if the agent is stuck in a loop by detecting duplicate content"""
        if len(self.memory.messages) < 2:
            return False

        last_message = self.memory.messages[-1]
        if not last_message.content:
            return False

        # Count identical content occurrences
        duplicate_count = sum(
            1
            for msg in reversed(self.memory.messages[:-1])
            if msg.role == "assistant" and msg.content == last_message.content
        )

        return duplicate_count >= self.duplicate_threshold

    @property
    def messages(self) -> List[Message]:
        """Retrieve a list of messages from the agent's memory."""
        return self.memory.messages

    @messages.setter
    def messages(self, value: List[Message]):
        """Set the list of messages in the agent's memory."""
        self.memory.messages = value

    def on(self, event_pattern: str, handler: EventHandler) -> None:
        """Register an event handler for events matching the specified pattern.

        Args:
            event_pattern: Regex pattern to match event names
            handler: The async function to be called when matching events occur.
                    The handler must accept event as its first parameter.

        Example:
            ```python
            # Subscribe to all lifecycle events
            async def on_lifecycle(event: EventItem):
                print(f"Lifecycle event {event.name} occurred with data: {event.content}")

            agent.on("agent:lifecycle:.*", on_lifecycle)

            # Subscribe to specific state changes
            async def on_state_change(event: EventItem):
                print(f"State changed from {event.old_state} to {event.new_state}")

            agent.on("agent:state:change", on_state_change)
            ```
        """
        if not callable(handler):
            raise ValueError("Event handler must be a callable")
        self._private_event_queue.add_handler(event_pattern, handler)

    def emit(
        self, name: str, data: Any, options: Optional[Dict[str, Any]] = None
    ) -> None:
        """Emit an event and add it to the processing queue.

        Args:
            name: The name of the event to emit
            data: Event data dictionary
            options: Optional event options

        Example:
            ```python
            # Simple event emission
            agent.emit("agent:state:change", {
                "old_state": old_state.value,
                "new_state": new_state.value
            })

            # Subscribe to events with regex pattern
            async def on_state_events(event: EventItem):
                print(f"Event {event.name}: State changed from {event.old_state} to {event.new_state}")

            agent.on("agent:state:.*", on_state_events)
            ```
        """
        if not self.enable_event_queue:
            return
        if options is None:
            options = {}
        if "id" not in options or options["id"] is None or options["id"] == "":
            options["id"] = str(uuid.uuid4())
        event = EventItem(
            id=options.get("id"),
            parent_id=options.get("parent_id"),
            name=name,
            step=self.current_step,
            timestamp=datetime.now(),
            content=data,
        )
        self._private_event_queue.put(event)

    async def terminate(self):
        """Request to terminate the current task."""
        logger.info(f"Terminating task {self.task_id}")
        self.should_terminate = True
        self.emit(BaseAgentEvents.LIFECYCLE_TERMINATING, {})

    async def cleanup(self):
        """Clean up the agent's resources."""
        if self.sandbox:
            await SANDBOX_MANAGER.delete_sandbox(self.sandbox.id)
