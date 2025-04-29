import os
from datetime import datetime
from typing import Optional, Union

from pydantic import BaseModel, Field, model_validator

from app.agent.base import BaseAgentEvents
from app.agent.browser import BrowserContextHelper
from app.agent.react import ReActAgent
from app.agent.toolcall import ToolCallContextHelper
from app.logger import logger
from app.prompt.manus import NEXT_STEP_PROMPT, PLAN_PROMPT, SYSTEM_PROMPT
from app.schema import Message
from app.tool import Terminate, ToolCollection
from app.tool.base import BaseTool
from app.tool.bash import Bash
from app.tool.browser_use_tool import BrowserUseTool
from app.tool.create_chat_completion import CreateChatCompletion
from app.tool.deep_research import DeepResearch
from app.tool.planning import PlanningTool
from app.tool.python_execute import PythonExecute
from app.tool.str_replace_editor import StrReplaceEditor
from app.tool.web_search import WebSearch

SYSTEM_TOOLS: list[BaseTool] = [
    Bash(),
    WebSearch(),
    DeepResearch(),
    BrowserUseTool(),
    StrReplaceEditor(),
    PlanningTool(),
    CreateChatCompletion(),
    PythonExecute(),
]

SYSTEM_TOOLS_MAP = {tool.name: tool.__class__ for tool in SYSTEM_TOOLS}


class McpToolConfig(BaseModel):
    id: str
    name: str
    command: str
    args: list[str]
    env: dict[str, str]


class Manus(ReActAgent):
    """A versatile general-purpose agent."""

    name: str = "Manus"
    description: str = (
        "A versatile agent that can solve various tasks using multiple tools"
    )

    system_prompt: str = SYSTEM_PROMPT.format(
        directory="/workspace",
        task_id="Not Specified",
        task_dir="Not Specified",
        language="English",
        current_date=datetime.now().strftime("%Y-%m-%d"),
        max_steps=20,
        current_step=0,
    )
    next_step_prompt: str = NEXT_STEP_PROMPT.format(
        max_steps=20,
        current_step=0,
        remaining_steps=20,
        task_dir="Not Specified",
    )
    plan_prompt: str = PLAN_PROMPT.format(
        max_steps=20,
        language="English",
        available_tools="",
    )

    max_steps: int = 20
    task_request: str = ""

    tool_call_context_helper: Optional[ToolCallContextHelper] = None
    browser_context_helper: Optional[BrowserContextHelper] = None

    task_dir: str = ""
    language: Optional[str] = Field(None, description="Language for the agent")

    def initialize(
        self,
        task_id: str,
        language: Optional[str] = None,
        tools: Optional[list[Union[McpToolConfig, str]]] = None,
        max_steps: Optional[int] = None,
        task_request: Optional[str] = None,
    ):
        self.task_id = task_id
        self.language = language
        self.task_dir = f"/workspace/{task_id}"
        self.current_step = 0
        self.tools = tools

        if max_steps is not None:
            self.max_steps = max_steps

        if task_request is not None:
            self.task_request = task_request

        return self

    @model_validator(mode="after")
    def initialize_helper(self) -> "Manus":
        return self

    async def prepare(self) -> None:
        """Prepare the agent for execution."""
        self.system_prompt = SYSTEM_PROMPT.format(
            directory="/workspace",
            task_id=self.task_id,
            task_dir=self.task_dir,
            language=self.language or "English",
            current_date=datetime.now().strftime("%Y-%m-%d"),
            max_steps=self.max_steps,
            current_step=self.current_step,
        )

        self.next_step_prompt = NEXT_STEP_PROMPT.format(
            max_steps=self.max_steps,
            current_step=self.current_step,
            remaining_steps=self.max_steps - self.current_step,
            task_dir=self.task_dir,
        )

        await self.update_memory(
            role="system", content=self.system_prompt, base64_image=None
        )

        self.browser_context_helper = BrowserContextHelper(self)
        self.tool_call_context_helper = ToolCallContextHelper(self)
        self.tool_call_context_helper.available_tools = ToolCollection(Terminate())

        if self.tools:
            for tool in self.tools:
                if isinstance(tool, str) and tool in SYSTEM_TOOLS_MAP:
                    inst = SYSTEM_TOOLS_MAP[tool]()
                    await self.tool_call_context_helper.add_tool(inst)
                    if hasattr(inst, "llm"):
                        inst.llm = self.llm
                elif isinstance(tool, McpToolConfig):
                    await self.tool_call_context_helper.add_mcp(
                        {
                            "client_id": tool.id,
                            "command": tool.command,
                            "args": tool.args,
                            "env": tool.env,
                        }
                    )

    async def plan(self) -> str:
        """Create an initial plan based on the user request."""
        # Create planning message
        self.emit(BaseAgentEvents.LIFECYCLE_PLAN_START, {})

        self.plan_prompt = PLAN_PROMPT.format(
            language=self.language or "English",
            max_steps=self.max_steps,
            available_tools="\n".join(
                [
                    f"- {tool.name}: {tool.description}"
                    for tool in self.tool_call_context_helper.available_tools
                ]
            ),
        )
        planning_message = await self.llm.ask(
            [
                Message.system_message(self.plan_prompt),
                Message.user_message(self.task_request),
            ],
            system_msgs=[Message.system_message(self.system_prompt)],
        )

        # Add the planning message to memory
        await self.update_memory("user", planning_message)
        self.emit(BaseAgentEvents.LIFECYCLE_PLAN_COMPLETE, {"plan": planning_message})
        return planning_message

    async def think(self) -> bool:
        """Process current state and decide next actions with appropriate context."""
        # Update next_step_prompt with current step information
        original_prompt = self.next_step_prompt
        self.next_step_prompt = NEXT_STEP_PROMPT.format(
            max_steps=self.max_steps,
            current_step=self.current_step,
            remaining_steps=self.max_steps - self.current_step,
            task_dir=self.task_dir,
        )

        browser_in_use = self._check_browser_in_use_recently()

        if browser_in_use:
            self.next_step_prompt = (
                await self.browser_context_helper.format_next_step_prompt()
            )

        result = await self.tool_call_context_helper.ask_tool()

        # Restore original prompt
        self.next_step_prompt = original_prompt

        return result

    async def act(self) -> str:
        """Execute decided actions"""
        results = await self.tool_call_context_helper.execute_tool()
        return "\n\n".join(results)

    def _check_browser_in_use_recently(self) -> bool:
        """Check if the browser is in use by looking at the last 3 messages."""
        recent_messages = self.memory.messages[-3:] if self.memory.messages else []
        browser_in_use = any(
            tc.function.name == BrowserUseTool().name
            for msg in recent_messages
            if msg.tool_calls
            for tc in msg.tool_calls
        )
        return browser_in_use

    async def cleanup(self):
        """Clean up Manus agent resources."""
        logger.info(f"🧹 Cleaning up resources for agent '{self.name}'...")
        if self.browser_context_helper:
            await self.browser_context_helper.cleanup_browser()
        if self.tool_call_context_helper:
            await self.tool_call_context_helper.cleanup_tools()
        if self.tool_call_context_helper.mcp:
            await self.tool_call_context_helper.mcp.disconnect_all()
        logger.info(f"✨ Cleanup complete for agent '{self.name}'.")
