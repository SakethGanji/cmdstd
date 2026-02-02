#!/usr/bin/env python3
"""One-time migration script to reorganize nodes/ into category subdirectories.

Run from the repo root:
    python3 reorganize_nodes.py

This script:
1. Creates category directories (core/, integrations/, output/) with __init__.py
2. Moves node files into their categories via git mv
3. Rewrites relative imports in moved files
4. Generates each category's __init__.py with proper exports
5. Regenerates nodes/__init__.py to import from subdirectories
6. Removes the old transform/ stub (replaced by core/)
"""

import os
import re
import subprocess
import sys

NODES_DIR = "apps/workflow-engine/src/nodes"

# Category mapping: filename (without .py) -> category folder
CATEGORY_MAP = {
    # triggers/
    "start": "triggers",
    "webhook": "triggers",
    "cron": "triggers",
    "error_trigger": "triggers",
    "execute_workflow_trigger": "triggers",
    # flow/
    "if_node": "flow",
    "switch": "flow",
    "merge": "flow",
    "loop": "flow",
    "split_in_batches": "flow",
    "wait": "flow",
    "stop_and_error": "flow",
    "execute_workflow": "flow",
    # core/ (data manipulation & transformation)
    "set_node": "core",
    "code": "core",
    "filter": "core",
    "item_lists": "core",
    "sample": "core",
    "object_read": "core",
    "object_write": "core",
    "object_store": "core",
    "read_file": "core",
    "write_file": "core",
    # integrations/ (external services)
    "http_request": "integrations",
    "postgres": "integrations",
    "mongodb": "integrations",
    "neo4j_node": "integrations",
    "send_email": "integrations",
    # ai/
    "llm_chat": "ai",
    "ai_agent": "ai",
    "chat_input": "ai",
    # output/ (display & response)
    "html_display": "output",
    "markdown_display": "output",
    "respond_to_webhook": "output",
    "pandas_explore": "output",
}

# Node class names exported from each file (filename -> class name)
# object_store is a utility module, not a node class — excluded here
NODE_CLASSES = {
    "start": "StartNode",
    "webhook": "WebhookNode",
    "cron": "CronNode",
    "error_trigger": "ErrorTriggerNode",
    "execute_workflow_trigger": "ExecuteWorkflowTriggerNode",
    "if_node": "IfNode",
    "switch": "SwitchNode",
    "merge": "MergeNode",
    "loop": "LoopNode",
    "split_in_batches": "SplitInBatchesNode",
    "wait": "WaitNode",
    "stop_and_error": "StopAndErrorNode",
    "execute_workflow": "ExecuteWorkflowNode",
    "set_node": "SetNode",
    "code": "CodeNode",
    "filter": "FilterNode",
    "item_lists": "ItemListsNode",
    "sample": "SampleNode",
    "object_read": "ObjectReadNode",
    "object_write": "ObjectWriteNode",
    "read_file": "ReadFileNode",
    "write_file": "WriteFileNode",
    "http_request": "HttpRequestNode",
    "postgres": "PostgresNode",
    "mongodb": "MongoDBNode",
    "neo4j_node": "Neo4jNode",
    "send_email": "SendEmailNode",
    "llm_chat": "LLMChatNode",
    "ai_agent": "AIAgentNode",
    "chat_input": "ChatInputNode",
    "html_display": "HTMLDisplayNode",
    "markdown_display": "MarkdownDisplayNode",
    "respond_to_webhook": "RespondToWebhookNode",
    "pandas_explore": "PandasExploreNode",
}

# Category metadata for __init__.py docstrings
CATEGORY_META = {
    "triggers": "Trigger nodes — workflow entry points.",
    "flow": "Flow control nodes — routing, branching, and looping.",
    "core": "Core nodes — data manipulation, transformation, and storage.",
    "integrations": "Integration nodes — external services and APIs.",
    "ai": "AI/LLM nodes — language models and agents.",
    "output": "Output nodes — display and response.",
}


def run(cmd: str, check: bool = True) -> subprocess.CompletedProcess:
    """Run a shell command."""
    print(f"  $ {cmd}")
    result = subprocess.run(cmd, shell=True, check=check, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"    STDERR: {result.stderr.strip()}")
    return result


def rewrite_imports(filepath: str) -> None:
    """Rewrite relative imports in a moved node file.

    After moving from nodes/foo.py to nodes/category/foo.py:
    - `from .base import ...`       -> `from ..base import ...`
    - `from .sibling import ...`    -> `from .sibling import ...` (if same category)
    -                               -> `from ..cat.sibling import ...` (if different category)
    - `from ..engine.xxx import ...` -> `from ...engine.xxx import ...`
    """
    with open(filepath, "r") as f:
        content = f.read()

    original = content

    # Get this file's category from the path
    parts = filepath.split(os.sep)
    this_category = parts[-2]

    # 1. `from .base import ...` -> `from ..base import ...`
    content = re.sub(r'from \.base import', 'from ..base import', content)

    # 2. `from .sibling import ...` -> depends on whether sibling is in same category
    def rewrite_sibling_import(m: re.Match) -> str:
        sibling = m.group(1)
        rest = m.group(2)

        sibling_category = CATEGORY_MAP.get(sibling)
        if sibling_category == this_category:
            # Same category, stays as .sibling
            return f"from .{sibling} import{rest}"
        elif sibling_category:
            # Different category
            return f"from ..{sibling_category}.{sibling} import{rest}"
        else:
            # Not in our map, add one more dot
            return f"from ..{sibling} import{rest}"

    content = re.sub(
        r'from \.([a-z_]+) import(.*)',
        rewrite_sibling_import,
        content,
    )

    # 3. `from ..engine.xxx import ...` -> `from ...engine.xxx import ...`
    content = re.sub(r'from \.\.engine\.', 'from ...engine.', content)

    if content != original:
        with open(filepath, "w") as f:
            f.write(content)
        print(f"  Rewrote imports in {filepath}")


def generate_category_init(category: str, files: list[str]) -> str:
    """Generate __init__.py content for a category directory."""
    docstring = CATEGORY_META.get(category, f"{category.title()} nodes.")
    lines = [f'"""{docstring}"""\n']

    node_files = sorted(f for f in files if f in NODE_CLASSES)

    for filename in node_files:
        class_name = NODE_CLASSES[filename]
        lines.append(f"from .{filename} import {class_name}")

    if node_files:
        lines.append("")

    all_exports = [NODE_CLASSES[f] for f in node_files]
    lines.append("__all__ = [")
    for export in all_exports:
        lines.append(f'    "{export}",')
    lines.append("]")
    lines.append("")

    return "\n".join(lines)


def generate_root_init(categories: dict[str, list[str]]) -> str:
    """Generate the new nodes/__init__.py that imports from subdirectories."""
    lines = [
        '"""Workflow node implementations.',
        "",
        "Nodes are organized into categories:",
        "- triggers: Entry point nodes (Start, Webhook, Cron, etc.)",
        "- flow: Flow control nodes (If, Switch, Merge, Loop, etc.)",
        "- core: Data manipulation nodes (Set, Code, Filter, etc.)",
        "- integrations: External service nodes (HTTP, Postgres, MongoDB, etc.)",
        "- ai: AI/LLM nodes (LLMChat, AIAgent, ChatInput)",
        "- output: Display & response nodes (HTML, Markdown, Webhook Response, etc.)",
        '"""',
        "",
        "from .base import BaseNode",
        "",
    ]

    category_order = ["triggers", "flow", "core", "integrations", "ai", "output"]
    all_exports = ["BaseNode"]

    for cat in category_order:
        files = categories.get(cat, [])
        node_files = sorted(f for f in files if f in NODE_CLASSES)
        if not node_files:
            continue

        lines.append(f"# {CATEGORY_META.get(cat, cat.title())}")
        for filename in node_files:
            class_name = NODE_CLASSES[filename]
            lines.append(f"from .{cat}.{filename} import {class_name}")
            all_exports.append(class_name)
        lines.append("")

    lines.append("# Category modules")
    for cat in category_order:
        lines.append(f"from . import {cat}")
        all_exports.append(cat)
    lines.append("")

    lines.append("__all__ = [")
    for export in all_exports:
        lines.append(f'    "{export}",')
    lines.append("]")
    lines.append("")

    return "\n".join(lines)


def main():
    if not os.path.isdir(NODES_DIR):
        print(f"ERROR: {NODES_DIR} not found. Run this from the repo root.")
        sys.exit(1)

    # Build reverse map: category -> list of filenames
    categories: dict[str, list[str]] = {}
    for filename, category in CATEGORY_MAP.items():
        categories.setdefault(category, []).append(filename)

    # Step 1: Create new category directories
    print("\n=== Step 1: Create category directories ===")
    for d in ["core", "integrations", "output"]:
        dirpath = os.path.join(NODES_DIR, d)
        os.makedirs(dirpath, exist_ok=True)
        print(f"  Created {dirpath}/")

    # Step 2: Remove old transform/ stub
    print("\n=== Step 2: Remove old transform/ stub ===")
    transform_init = os.path.join(NODES_DIR, "transform", "__init__.py")
    if os.path.exists(transform_init):
        run(f"git rm -f {transform_init}")
    transform_dir = os.path.join(NODES_DIR, "transform")
    if os.path.isdir(transform_dir):
        # Remove __pycache__ if present
        pycache = os.path.join(transform_dir, "__pycache__")
        if os.path.isdir(pycache):
            import shutil
            shutil.rmtree(pycache)
        try:
            os.rmdir(transform_dir)
            print(f"  Removed {transform_dir}/")
        except OSError as e:
            print(f"  Warning: Could not remove {transform_dir}/: {e}")

    # Step 3: Move node files via git mv
    print("\n=== Step 3: Move node files ===")
    for filename, category in sorted(CATEGORY_MAP.items()):
        src = os.path.join(NODES_DIR, f"{filename}.py")
        dst_dir = os.path.join(NODES_DIR, category)
        dst = os.path.join(dst_dir, f"{filename}.py")

        if not os.path.exists(src):
            if os.path.exists(dst):
                print(f"  Already moved: {dst}")
            else:
                print(f"  WARNING: {src} not found!")
            continue

        run(f"git mv {src} {dst}")

    # Step 4: Rewrite imports in all moved files
    print("\n=== Step 4: Rewrite imports ===")
    for filename, category in sorted(CATEGORY_MAP.items()):
        filepath = os.path.join(NODES_DIR, category, f"{filename}.py")
        if os.path.exists(filepath):
            rewrite_imports(filepath)

    # Step 5: Generate category __init__.py files
    print("\n=== Step 5: Generate category __init__.py files ===")
    for category, files in sorted(categories.items()):
        init_path = os.path.join(NODES_DIR, category, "__init__.py")
        content = generate_category_init(category, files)
        with open(init_path, "w") as f:
            f.write(content)
        print(f"  Wrote {init_path}")

    # Step 6: Regenerate nodes/__init__.py
    print("\n=== Step 6: Regenerate nodes/__init__.py ===")
    root_init = os.path.join(NODES_DIR, "__init__.py")
    content = generate_root_init(categories)
    with open(root_init, "w") as f:
        f.write(content)
    print(f"  Wrote {root_init}")

    # Step 7: Stage new __init__.py files
    print("\n=== Step 7: Stage new files ===")
    for d in ["core", "integrations", "output"]:
        init_path = os.path.join(NODES_DIR, d, "__init__.py")
        run(f"git add {init_path}")

    print("\n=== Done! ===")
    print("\nVerification:")
    print("  python3 -c \"import sys; sys.path.insert(0, 'apps/workflow-engine'); from src.nodes import *; print('OK')\"")
    print("  git diff --stat")


if __name__ == "__main__":
    main()
