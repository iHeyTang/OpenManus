import asyncio
from datetime import datetime
from typing import Dict

from app.agent.manus import Manus
from app.apis.models.task import Task
from app.utils.agent_event import EventItem


class TaskManager:
    def __init__(self):
        self.tasks: Dict[str, Task] = {}
        self.queues: Dict[str, asyncio.Queue] = {}

    def create_task(self, task_id: str, agent: Manus) -> Task:
        task = Task(
            id=task_id,
            created_at=datetime.now(),
            agent=agent,
        )
        self.tasks[task_id] = task
        self.queues[task_id] = asyncio.Queue()
        return task

    async def update_task_progress(self, task_id: str, event: EventItem):
        if task_id in self.tasks:
            task = self.tasks[task_id]
            # Use the same step value for both progress and message
            await self.queues[task_id].put(
                {
                    "id": event.id,
                    "parent_id": event.parent_id,
                    "type": "progress",
                    "name": event.name,
                    "step": event.step,
                    "content": event.content,
                }
            )

    async def terminate_task(self, task_id: str):
        if task_id in self.tasks:
            task = self.tasks[task_id]
            await task.agent.terminate()
            await self.remove_task(task_id)

    async def remove_task(self, task_id: str):
        if task_id in self.tasks:
            del self.tasks[task_id]
            del self.queues[task_id]


task_manager = TaskManager()
