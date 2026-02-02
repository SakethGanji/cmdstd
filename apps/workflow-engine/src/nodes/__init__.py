"""Workflow node implementations.

Nodes are organized into categories:
- triggers: Entry point nodes (Start, Webhook, Cron, etc.)
- flow: Flow control nodes (If, Switch, Merge, Loop, etc.)
- core: Data manipulation nodes (Set, Code, Filter, etc.)
- integrations: External service nodes (HTTP, Postgres, MongoDB, etc.)
- ai: AI/LLM nodes (LLMChat, AIAgent, ChatInput)
- output: Display & response nodes (HTML, Markdown, Webhook Response, etc.)
"""

from .base import BaseNode

# Trigger nodes — workflow entry points.
from .triggers.cron import CronNode
from .triggers.error_trigger import ErrorTriggerNode
from .triggers.execute_workflow_trigger import ExecuteWorkflowTriggerNode
from .triggers.start import StartNode
from .triggers.webhook import WebhookNode

# Flow control nodes — routing, branching, and looping.
from .flow.execute_workflow import ExecuteWorkflowNode
from .flow.if_node import IfNode
from .flow.loop import LoopNode
from .flow.merge import MergeNode
from .flow.split_in_batches import SplitInBatchesNode
from .flow.stop_and_error import StopAndErrorNode
from .flow.switch import SwitchNode
from .flow.wait import WaitNode

# Core nodes — data manipulation, transformation, and storage.
from .core.code import CodeNode
from .core.filter import FilterNode
from .core.item_lists import ItemListsNode
from .core.object_read import ObjectReadNode
from .core.object_write import ObjectWriteNode
from .core.read_file import ReadFileNode
from .core.sample import SampleNode
from .core.set_node import SetNode
from .core.write_file import WriteFileNode

# Integration nodes — external services and APIs.
from .integrations.http_request import HttpRequestNode
from .integrations.mongodb import MongoDBNode
from .integrations.neo4j_node import Neo4jNode
from .integrations.postgres import PostgresNode
from .integrations.send_email import SendEmailNode

# AI/LLM nodes — language models and agents.
from .ai.ai_agent import AIAgentNode
from .ai.chat_input import ChatInputNode
from .ai.llm_chat import LLMChatNode

# Output nodes — display and response.
from .output.html_display import HTMLDisplayNode
from .output.markdown_display import MarkdownDisplayNode
from .output.pandas_explore import PandasExploreNode
from .output.respond_to_webhook import RespondToWebhookNode

# Category modules
from . import triggers
from . import flow
from . import core
from . import integrations
from . import ai
from . import output

__all__ = [
    "BaseNode",
    "CronNode",
    "ErrorTriggerNode",
    "ExecuteWorkflowTriggerNode",
    "StartNode",
    "WebhookNode",
    "ExecuteWorkflowNode",
    "IfNode",
    "LoopNode",
    "MergeNode",
    "SplitInBatchesNode",
    "StopAndErrorNode",
    "SwitchNode",
    "WaitNode",
    "CodeNode",
    "FilterNode",
    "ItemListsNode",
    "ObjectReadNode",
    "ObjectWriteNode",
    "ReadFileNode",
    "SampleNode",
    "SetNode",
    "WriteFileNode",
    "HttpRequestNode",
    "MongoDBNode",
    "Neo4jNode",
    "PostgresNode",
    "SendEmailNode",
    "AIAgentNode",
    "ChatInputNode",
    "LLMChatNode",
    "HTMLDisplayNode",
    "MarkdownDisplayNode",
    "PandasExploreNode",
    "RespondToWebhookNode",
    "triggers",
    "flow",
    "core",
    "integrations",
    "ai",
    "output",
]
