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
from .execute_workflow_trigger import ExecuteWorkflowTriggerNode

# Flow control nodes
from .if_node import IfNode
from .switch import SwitchNode
from .merge import MergeNode
from .wait import WaitNode
from .split_in_batches import SplitInBatchesNode
from .loop import LoopNode
from .execute_workflow import ExecuteWorkflowNode
from .stop_and_error import StopAndErrorNode

# Transform nodes
from .set_node import SetNode
from .http_request import HttpRequestNode
from .code import CodeNode
from .read_file import ReadFileNode
from .write_file import WriteFileNode
from .pandas_explore import PandasExploreNode
from .html_display import HTMLDisplayNode
from .markdown_display import MarkdownDisplayNode
from .object_read import ObjectReadNode
from .object_write import ObjectWriteNode
from .filter import FilterNode
from .item_lists import ItemListsNode
from .respond_to_webhook import RespondToWebhookNode
from .sample import SampleNode
from .send_email import SendEmailNode

# AI nodes
from .llm_chat import LLMChatNode
from .ai_agent import AIAgentNode

# UI nodes
from .chat_input import ChatInputNode

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
    "ExecuteWorkflowTriggerNode",
    # Flow control
    "IfNode",
    "SwitchNode",
    "MergeNode",
    "WaitNode",
    "SplitInBatchesNode",
    "LoopNode",
    "ExecuteWorkflowNode",
    "StopAndErrorNode",
    # Transform
    "SetNode",
    "HttpRequestNode",
    "CodeNode",
    "ReadFileNode",
    "WriteFileNode",
    "PandasExploreNode",
    "HTMLDisplayNode",
    "MarkdownDisplayNode",
    "ObjectReadNode",
    "ObjectWriteNode",
    "FilterNode",
    "ItemListsNode",
    "RespondToWebhookNode",
    "SampleNode",
    "SendEmailNode",
    # AI
    "LLMChatNode",
    "AIAgentNode",
    # UI
    "ChatInputNode",
    # Category modules
    "triggers",
    "flow",
    "transform",
    "ai",
]
