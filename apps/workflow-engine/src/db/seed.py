"""Seed database with demo workflows for management presentation."""

from __future__ import annotations

import asyncio
import hashlib
import json
import time
from datetime import datetime

from sqlalchemy import select, delete

from .session import async_session_factory, init_db
from .models import WorkflowModel


def generate_workflow_id(name: str) -> str:
    """Generate a unique workflow ID."""
    timestamp = int(time.time() * 1000)
    hash_input = f"{timestamp}_{name}"
    hash_suffix = hashlib.sha256(hash_input.encode()).hexdigest()[:8]
    return f"wf_{timestamp}_{hash_suffix}"


EXAMPLE_WORKFLOWS = [
    # ========================================
    # 1. RESEARCH AGENT - Multi-tool agent with code + calculator + time
    # ========================================
    {
        "name": "Research Agent",
        "description": "AI agent with calculator, code execution, and time tools. Solves analytical tasks autonomously. POST with {\"task\": \"Calculate compound interest on $10,000 at 5% for 10 years, then write Python code to generate an amortization schedule\"}",
        "active": True,
        "definition": {
            "nodes": [
                {
                    "name": "Webhook",
                    "type": "Webhook",
                    "parameters": {"method": "POST"},
                    "position": {"x": 100, "y": 300},
                },
                {
                    "name": "Extract Task",
                    "type": "Set",
                    "parameters": {
                        "mode": "manual",
                        "fields": [
                            {"name": "task", "value": "{{ $json.body.task }}"},
                        ],
                    },
                    "position": {"x": 300, "y": 300},
                },
                {
                    "name": "Calculator",
                    "type": "CalculatorTool",
                    "parameters": {},
                    "position": {"x": 500, "y": 100},
                },
                {
                    "name": "Code Runner",
                    "type": "CodeTool",
                    "parameters": {},
                    "position": {"x": 500, "y": 300},
                },
                {
                    "name": "Clock",
                    "type": "CurrentTimeTool",
                    "parameters": {},
                    "position": {"x": 500, "y": 500},
                },
                {
                    "name": "Agent",
                    "type": "AIAgent",
                    "parameters": {
                        "model": "gemini-2.0-flash",
                        "systemPrompt": "You are a research analyst agent. Use your tools to solve problems step by step. Use the calculator for arithmetic, the code tool for complex computations or data processing, and the time tool when you need current date/time. Always show your work.",
                        "task": "{{ $json.task }}",
                        "temperature": 0.3,
                        "maxIterations": 15,
                    },
                    "position": {"x": 750, "y": 300},
                },
                {
                    "name": "Respond",
                    "type": "RespondToWebhook",
                    "parameters": {
                        "statusCode": "200",
                        "responseMode": "lastNode",
                    },
                    "position": {"x": 1000, "y": 300},
                },
            ],
            "connections": [
                {"source_node": "Webhook", "target_node": "Extract Task"},
                {"source_node": "Extract Task", "target_node": "Agent"},
                {"source_node": "Calculator", "target_node": "Agent", "connection_type": "subnode", "slot_name": "tools"},
                {"source_node": "Code Runner", "target_node": "Agent", "connection_type": "subnode", "slot_name": "tools"},
                {"source_node": "Clock", "target_node": "Agent", "connection_type": "subnode", "slot_name": "tools"},
                {"source_node": "Agent", "target_node": "Respond"},
            ],
            "settings": {},
        },
    },
    # ========================================
    # 2. DATA ANALYST AGENT - Code-heavy agent for data tasks
    # ========================================
    {
        "name": "Data Analyst Agent",
        "description": "AI agent that writes and executes Python code to analyze data. POST with {\"task\": \"Generate a dataset of 50 employees with name, department, salary, and years of experience. Then calculate average salary by department and find the top 3 highest paid employees.\"}",
        "active": True,
        "definition": {
            "nodes": [
                {
                    "name": "Webhook",
                    "type": "Webhook",
                    "parameters": {"method": "POST"},
                    "position": {"x": 100, "y": 300},
                },
                {
                    "name": "Extract Task",
                    "type": "Set",
                    "parameters": {
                        "mode": "manual",
                        "fields": [
                            {"name": "task", "value": "{{ $json.body.task }}"},
                        ],
                    },
                    "position": {"x": 300, "y": 300},
                },
                {
                    "name": "Code Executor",
                    "type": "CodeTool",
                    "parameters": {},
                    "position": {"x": 500, "y": 200},
                },
                {
                    "name": "Calculator",
                    "type": "CalculatorTool",
                    "parameters": {},
                    "position": {"x": 500, "y": 400},
                },
                {
                    "name": "Agent",
                    "type": "AIAgent",
                    "parameters": {
                        "model": "gemini-2.0-flash",
                        "systemPrompt": "You are a senior data analyst. Write Python code to solve data analysis tasks. Use the code tool to execute Python. You can use standard library modules like random, statistics, collections, json, math, datetime. Structure your output clearly with headers and formatted numbers. When presenting results, use the code tool to format them nicely.",
                        "task": "{{ $json.task }}",
                        "temperature": 0.2,
                        "maxIterations": 20,
                    },
                    "position": {"x": 750, "y": 300},
                },
                {
                    "name": "Respond",
                    "type": "RespondToWebhook",
                    "parameters": {
                        "statusCode": "200",
                        "responseMode": "lastNode",
                    },
                    "position": {"x": 1000, "y": 300},
                },
            ],
            "connections": [
                {"source_node": "Webhook", "target_node": "Extract Task"},
                {"source_node": "Extract Task", "target_node": "Agent"},
                {"source_node": "Code Executor", "target_node": "Agent", "connection_type": "subnode", "slot_name": "tools"},
                {"source_node": "Calculator", "target_node": "Agent", "connection_type": "subnode", "slot_name": "tools"},
                {"source_node": "Agent", "target_node": "Respond"},
            ],
            "settings": {},
        },
    },
    # ========================================
    # 3. MULTI-AGENT COORDINATOR - Sub-agent spawning
    # ========================================
    {
        "name": "Multi-Agent Coordinator",
        "description": "Manager agent that spawns specialized sub-agents. POST with {\"task\": \"I need a comprehensive analysis of a $500,000 commercial real estate investment. Analyze the financial viability, market risks, and regulatory considerations.\"}",
        "active": True,
        "definition": {
            "nodes": [
                {
                    "name": "Webhook",
                    "type": "Webhook",
                    "parameters": {"method": "POST"},
                    "position": {"x": 100, "y": 300},
                },
                {
                    "name": "Extract Task",
                    "type": "Set",
                    "parameters": {
                        "mode": "manual",
                        "fields": [
                            {"name": "task", "value": "{{ $json.body.task }}"},
                        ],
                    },
                    "position": {"x": 300, "y": 300},
                },
                {
                    "name": "Calculator",
                    "type": "CalculatorTool",
                    "parameters": {},
                    "position": {"x": 500, "y": 200},
                },
                {
                    "name": "Code Runner",
                    "type": "CodeTool",
                    "parameters": {},
                    "position": {"x": 500, "y": 400},
                },
                {
                    "name": "Coordinator",
                    "type": "AIAgent",
                    "parameters": {
                        "model": "gemini-2.0-flash",
                        "systemPrompt": "You are a senior manager AI that coordinates complex tasks by delegating to specialized sub-agents. For each task:\n\n1. Break the task into 2-3 sub-tasks\n2. Use spawn_agents_parallel to delegate sub-tasks to specialist agents simultaneously\n3. Synthesize the results from all sub-agents into a comprehensive final report\n\nWhen spawning agents, give each a clear role and specific task. You can also use calculator and code tools directly for quick computations.",
                        "task": "{{ $json.task }}",
                        "temperature": 0.4,
                        "maxIterations": 15,
                        "enableSubAgents": True,
                        "maxAgentDepth": 2,
                        "allowRecursiveSpawn": False,
                    },
                    "position": {"x": 750, "y": 300},
                },
                {
                    "name": "Respond",
                    "type": "RespondToWebhook",
                    "parameters": {
                        "statusCode": "200",
                        "responseMode": "lastNode",
                    },
                    "position": {"x": 1000, "y": 300},
                },
            ],
            "connections": [
                {"source_node": "Webhook", "target_node": "Extract Task"},
                {"source_node": "Extract Task", "target_node": "Coordinator"},
                {"source_node": "Calculator", "target_node": "Coordinator", "connection_type": "subnode", "slot_name": "tools"},
                {"source_node": "Code Runner", "target_node": "Coordinator", "connection_type": "subnode", "slot_name": "tools"},
                {"source_node": "Coordinator", "target_node": "Respond"},
            ],
            "settings": {},
        },
    },
    # ========================================
    # 4. STRUCTURED OUTPUT AGENT - JSON schema enforcement
    # ========================================
    {
        "name": "Structured Output Agent",
        "description": "Agent that returns structured JSON matching a schema. POST with {\"task\": \"Analyze the sentiment and key topics in this text: The new banking app is fantastic for transfers but the loan application process is confusing and slow. Customer support was helpful though.\"}",
        "active": True,
        "definition": {
            "nodes": [
                {
                    "name": "Webhook",
                    "type": "Webhook",
                    "parameters": {"method": "POST"},
                    "position": {"x": 100, "y": 300},
                },
                {
                    "name": "Extract Task",
                    "type": "Set",
                    "parameters": {
                        "mode": "manual",
                        "fields": [
                            {"name": "task", "value": "{{ $json.body.task }}"},
                        ],
                    },
                    "position": {"x": 300, "y": 300},
                },
                {
                    "name": "Agent",
                    "type": "AIAgent",
                    "parameters": {
                        "model": "gemini-2.0-flash",
                        "systemPrompt": "You are a text analysis AI. Analyze the given text and return structured results. Be precise and thorough.",
                        "task": "{{ $json.task }}",
                        "temperature": 0.1,
                        "maxIterations": 5,
                        "outputSchema": json.dumps({
                            "type": "object",
                            "properties": {
                                "overall_sentiment": {
                                    "type": "string",
                                    "enum": ["very_positive", "positive", "neutral", "negative", "very_negative"],
                                },
                                "confidence": {"type": "number"},
                                "topics": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "topic": {"type": "string"},
                                            "sentiment": {"type": "string"},
                                            "keywords": {
                                                "type": "array",
                                                "items": {"type": "string"},
                                            },
                                        },
                                    },
                                },
                                "summary": {"type": "string"},
                            },
                        }),
                    },
                    "position": {"x": 550, "y": 300},
                },
                {
                    "name": "Respond",
                    "type": "RespondToWebhook",
                    "parameters": {
                        "statusCode": "200",
                        "responseMode": "lastNode",
                    },
                    "position": {"x": 800, "y": 300},
                },
            ],
            "connections": [
                {"source_node": "Webhook", "target_node": "Extract Task"},
                {"source_node": "Extract Task", "target_node": "Agent"},
                {"source_node": "Agent", "target_node": "Respond"},
            ],
            "settings": {},
        },
    },
    # ========================================
    # 5. FULL-STACK AGENT - All tools + memory + sub-agents
    # ========================================
    {
        "name": "Full-Stack Agent",
        "description": "Agent with every capability enabled: calculator, code, HTTP, time, text, memory, and sub-agent spawning. POST with {\"task\": \"Fetch the top 10 HackerNews stories from the API (https://hacker-news.firebaseio.com/v0/topstories.json gives IDs, then https://hacker-news.firebaseio.com/v0/item/{id}.json for each). Summarize them and calculate the average score.\"}",
        "active": True,
        "definition": {
            "nodes": [
                {
                    "name": "Webhook",
                    "type": "Webhook",
                    "parameters": {"method": "POST"},
                    "position": {"x": 100, "y": 350},
                },
                {
                    "name": "Extract Task",
                    "type": "Set",
                    "parameters": {
                        "mode": "manual",
                        "fields": [
                            {"name": "task", "value": "{{ $json.body.task }}"},
                        ],
                    },
                    "position": {"x": 300, "y": 350},
                },
                {
                    "name": "Calculator",
                    "type": "CalculatorTool",
                    "parameters": {},
                    "position": {"x": 500, "y": 100},
                },
                {
                    "name": "Code Runner",
                    "type": "CodeTool",
                    "parameters": {},
                    "position": {"x": 500, "y": 250},
                },
                {
                    "name": "HTTP Client",
                    "type": "HttpRequestTool",
                    "parameters": {},
                    "position": {"x": 500, "y": 400},
                },
                {
                    "name": "Clock",
                    "type": "CurrentTimeTool",
                    "parameters": {},
                    "position": {"x": 500, "y": 550},
                },
                {
                    "name": "Text Utils",
                    "type": "TextTool",
                    "parameters": {},
                    "position": {"x": 700, "y": 100},
                },
                {
                    "name": "Memory",
                    "type": "SQLiteMemory",
                    "parameters": {"sessionId": "full-stack-agent"},
                    "position": {"x": 700, "y": 550},
                },
                {
                    "name": "Agent",
                    "type": "AIAgent",
                    "parameters": {
                        "model": "gemini-2.0-flash",
                        "systemPrompt": "You are a powerful full-stack AI agent with access to many tools:\n- Calculator: for math\n- Code: execute Python for data processing\n- HTTP: make API requests to fetch data\n- Time: get current date/time\n- Text: word count, character count, text manipulation\n- Sub-agents: spawn specialized agents for parallel work\n\nUse the right tool for each sub-task. For API calls, use the http_request tool. For data processing, use the code tool. Be resourceful and chain tools together to accomplish complex tasks.",
                        "task": "{{ $json.task }}",
                        "temperature": 0.3,
                        "maxIterations": 25,
                        "enableSubAgents": True,
                        "maxAgentDepth": 2,
                        "allowRecursiveSpawn": False,
                    },
                    "position": {"x": 900, "y": 350},
                },
                {
                    "name": "Respond",
                    "type": "RespondToWebhook",
                    "parameters": {
                        "statusCode": "200",
                        "responseMode": "lastNode",
                    },
                    "position": {"x": 1150, "y": 350},
                },
            ],
            "connections": [
                {"source_node": "Webhook", "target_node": "Extract Task"},
                {"source_node": "Extract Task", "target_node": "Agent"},
                {"source_node": "Calculator", "target_node": "Agent", "connection_type": "subnode", "slot_name": "tools"},
                {"source_node": "Code Runner", "target_node": "Agent", "connection_type": "subnode", "slot_name": "tools"},
                {"source_node": "HTTP Client", "target_node": "Agent", "connection_type": "subnode", "slot_name": "tools"},
                {"source_node": "Clock", "target_node": "Agent", "connection_type": "subnode", "slot_name": "tools"},
                {"source_node": "Text Utils", "target_node": "Agent", "connection_type": "subnode", "slot_name": "tools"},
                {"source_node": "Memory", "target_node": "Agent", "connection_type": "subnode", "slot_name": "memory"},
                {"source_node": "Agent", "target_node": "Respond"},
            ],
            "settings": {},
        },
    },
    # ========================================
    # 6. LOAN DECISION AGENT - Banking-specific agentic workflow
    # ========================================
    {
        "name": "Loan Decision Agent",
        "description": "AI agent that autonomously evaluates loan applications using tools. POST with {\"task\": \"Evaluate this loan application: Applicant Sarah Johnson, requesting $250,000 for home purchase. Annual income $95,000, employment 5 years at TechCorp, credit score 720. Calculate DTI, risk score, and provide a detailed underwriting recommendation.\"}",
        "active": True,
        "definition": {
            "nodes": [
                {
                    "name": "Webhook",
                    "type": "Webhook",
                    "parameters": {"method": "POST"},
                    "position": {"x": 100, "y": 300},
                },
                {
                    "name": "Extract Task",
                    "type": "Set",
                    "parameters": {
                        "mode": "manual",
                        "fields": [
                            {"name": "task", "value": "{{ $json.body.task }}"},
                        ],
                    },
                    "position": {"x": 300, "y": 300},
                },
                {
                    "name": "Calculator",
                    "type": "CalculatorTool",
                    "parameters": {},
                    "position": {"x": 500, "y": 150},
                },
                {
                    "name": "Code Runner",
                    "type": "CodeTool",
                    "parameters": {},
                    "position": {"x": 500, "y": 450},
                },
                {
                    "name": "Agent",
                    "type": "AIAgent",
                    "parameters": {
                        "model": "gemini-2.0-flash",
                        "systemPrompt": "You are a senior loan underwriter AI at a major bank. Evaluate loan applications thoroughly:\n\n1. Use the calculator to compute: DTI ratio, loan-to-income ratio, monthly payment estimates (assume 6.5% APR for 30yr fixed)\n2. Use the code tool to run a risk scoring model:\n   - Credit score: 750+ = 30pts, 700-749 = 20pts, 650-699 = 10pts, <650 = 0pts\n   - DTI: <28% = 30pts, 28-36% = 20pts, 36-43% = 10pts, >43% = 0pts\n   - Employment: 5+ yrs = 25pts, 2-4 yrs = 15pts, <2 yrs = 5pts\n   - LTI ratio: <3x = 15pts, 3-4x = 10pts, >4x = 0pts\n3. Make a decision: 80+ APPROVED, 60-79 APPROVED WITH CONDITIONS, 40-59 REFER TO UNDERWRITER, <40 DECLINED\n4. Provide a professional assessment with specific recommendations",
                        "task": "{{ $json.task }}",
                        "temperature": 0.2,
                        "maxIterations": 15,
                    },
                    "position": {"x": 750, "y": 300},
                },
                {
                    "name": "Respond",
                    "type": "RespondToWebhook",
                    "parameters": {
                        "statusCode": "200",
                        "responseMode": "lastNode",
                    },
                    "position": {"x": 1000, "y": 300},
                },
            ],
            "connections": [
                {"source_node": "Webhook", "target_node": "Extract Task"},
                {"source_node": "Extract Task", "target_node": "Agent"},
                {"source_node": "Calculator", "target_node": "Agent", "connection_type": "subnode", "slot_name": "tools"},
                {"source_node": "Code Runner", "target_node": "Agent", "connection_type": "subnode", "slot_name": "tools"},
                {"source_node": "Agent", "target_node": "Respond"},
            ],
            "settings": {},
        },
    },
    # ========================================
    # 7. COMPETITIVE INTEL AGENT - HTTP + Code + Sub-agents
    # ========================================
    {
        "name": "Competitive Intel Agent",
        "description": "Agent that fetches public API data and analyzes it. POST with {\"task\": \"Fetch the current Bitcoin price from https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd,eur and analyze the prices. Calculate price ratios between the coins and write a brief market summary.\"}",
        "active": True,
        "definition": {
            "nodes": [
                {
                    "name": "Webhook",
                    "type": "Webhook",
                    "parameters": {"method": "POST"},
                    "position": {"x": 100, "y": 300},
                },
                {
                    "name": "Extract Task",
                    "type": "Set",
                    "parameters": {
                        "mode": "manual",
                        "fields": [
                            {"name": "task", "value": "{{ $json.body.task }}"},
                        ],
                    },
                    "position": {"x": 300, "y": 300},
                },
                {
                    "name": "HTTP Client",
                    "type": "HttpRequestTool",
                    "parameters": {},
                    "position": {"x": 500, "y": 150},
                },
                {
                    "name": "Code Runner",
                    "type": "CodeTool",
                    "parameters": {},
                    "position": {"x": 500, "y": 300},
                },
                {
                    "name": "Calculator",
                    "type": "CalculatorTool",
                    "parameters": {},
                    "position": {"x": 500, "y": 450},
                },
                {
                    "name": "Agent",
                    "type": "AIAgent",
                    "parameters": {
                        "model": "gemini-2.0-flash",
                        "systemPrompt": "You are a market intelligence analyst. Use the http_request tool to fetch data from APIs, then use calculator and code tools to analyze the results. Present findings in a clear, professional format with numbers and percentages.",
                        "task": "{{ $json.task }}",
                        "temperature": 0.3,
                        "maxIterations": 15,
                    },
                    "position": {"x": 750, "y": 300},
                },
                {
                    "name": "Respond",
                    "type": "RespondToWebhook",
                    "parameters": {
                        "statusCode": "200",
                        "responseMode": "lastNode",
                    },
                    "position": {"x": 1000, "y": 300},
                },
            ],
            "connections": [
                {"source_node": "Webhook", "target_node": "Extract Task"},
                {"source_node": "Extract Task", "target_node": "Agent"},
                {"source_node": "HTTP Client", "target_node": "Agent", "connection_type": "subnode", "slot_name": "tools"},
                {"source_node": "Code Runner", "target_node": "Agent", "connection_type": "subnode", "slot_name": "tools"},
                {"source_node": "Calculator", "target_node": "Agent", "connection_type": "subnode", "slot_name": "tools"},
                {"source_node": "Agent", "target_node": "Respond"},
            ],
            "settings": {},
        },
    },
]


async def seed_workflows(reset: bool = False) -> None:
    """Seed the database with example workflows."""
    await init_db()

    async with async_session_factory() as session:
        if reset:
            await session.execute(delete(WorkflowModel))
            await session.commit()
            print("Cleared existing workflows.")

        result = await session.execute(select(WorkflowModel.name))
        existing_names = {row[0] for row in result.fetchall()}

        added = 0
        skipped = 0
        for workflow_data in EXAMPLE_WORKFLOWS:
            if workflow_data["name"] in existing_names:
                skipped += 1
                continue

            workflow_id = workflow_data.get("id") or generate_workflow_id(workflow_data["name"])

            # Support both formats:
            # - Backend format: { name, nodes, connections }
            # - Legacy format: { name, definition: { nodes, connections } }
            if "definition" in workflow_data:
                definition = workflow_data["definition"]
            else:
                definition = {
                    "nodes": workflow_data.get("nodes", []),
                    "connections": workflow_data.get("connections", []),
                    "settings": workflow_data.get("settings", {}),
                }

            workflow = WorkflowModel(
                id=workflow_id,
                name=workflow_data["name"],
                description=workflow_data.get("description", ""),
                active=workflow_data.get("active", False),
                definition=definition,
                created_at=datetime.now(),
                updated_at=datetime.now(),
            )
            session.add(workflow)
            added += 1
            status = "ACTIVE" if workflow_data.get("active") else "inactive"
            print(f"Added [{status}]: {workflow_data['name']}")

        await session.commit()
        print(f"\nSeeding complete. Added {added} workflows" + (f", skipped {skipped} existing." if skipped else "."))


def main() -> None:
    """Run the seed script."""
    asyncio.run(seed_workflows(reset=True))


if __name__ == "__main__":
    main()
