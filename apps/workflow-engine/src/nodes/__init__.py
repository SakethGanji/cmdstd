"""Workflow node implementations.

Nodes are organized into categories:
- triggers: Entry point nodes (Start, Webhook, Cron, ErrorTrigger)
- flow: Flow control nodes (If, Switch, Merge, Wait, SplitInBatches)
- transform: Data transformation nodes (Set, Code, HttpRequest, ReadFile, etc.)
- ai: AI/LLM nodes (LLMChat, AIAgent)
"""

from .base import BaseNode

# Trigger nodes
from .start import StartNode
from .webhook import WebhookNode
from .cron import CronNode
from .error_trigger import ErrorTriggerNode

# Flow control nodes
from .if_node import IfNode
from .switch import SwitchNode
from .merge import MergeNode
from .wait import WaitNode
from .split_in_batches import SplitInBatchesNode
from .execute_workflow import ExecuteWorkflowNode

# Transform nodes
from .set_node import SetNode
from .http_request import HttpRequestNode
from .code import CodeNode
from .read_file import ReadFileNode
from .pandas_explore import PandasExploreNode
from .html_display import HTMLDisplayNode
from .object_read import ObjectReadNode
from .object_write import ObjectWriteNode

# AI nodes
from .llm_chat import LLMChatNode
from .ai_agent import AIAgentNode

# UI nodes
from .chat_input import ChatInputNode
from .chat_output import ChatOutputNode

# Category exports for convenience
from . import triggers
from . import flow
from . import transform
from . import ai

__all__ = [
    # Base
    "BaseNode",
    # Triggers
    "StartNode",
    "WebhookNode",
    "CronNode",
    "ErrorTriggerNode",
    # Flow control
    "IfNode",
    "SwitchNode",
    "MergeNode",
    "WaitNode",
    "SplitInBatchesNode",
    "ExecuteWorkflowNode",
    # Transform
    "SetNode",
    "HttpRequestNode",
    "CodeNode",
    "ReadFileNode",
    "PandasExploreNode",
    "HTMLDisplayNode",
    "ObjectReadNode",
    "ObjectWriteNode",
    # AI
    "LLMChatNode",
    "AIAgentNode",
    # UI
    "ChatInputNode",
    "ChatOutputNode",
    # Category modules
    "triggers",
    "flow",
    "transform",
    "ai",
]
