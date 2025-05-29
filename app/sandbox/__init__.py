"""
Docker Sandbox Module

Provides secure containerized execution environment with resource limits
and isolation for running untrusted code.
"""

from app.sandbox.client import BaseSandboxClient, LocalSandboxClient
from app.sandbox.core.exceptions import (
    SandboxError,
    SandboxResourceError,
    SandboxTimeoutError,
)
from app.sandbox.core.manager import SandboxManager
from app.sandbox.core.sandbox import DockerSandbox

__all__ = [
    "DockerSandbox",
    "SandboxManager",
    "BaseSandboxClient",
    "LocalSandboxClient",
    "SandboxError",
    "SandboxTimeoutError",
    "SandboxResourceError",
]
