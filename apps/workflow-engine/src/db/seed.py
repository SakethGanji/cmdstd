"""Seed database with example workflows."""

from __future__ import annotations

import asyncio
import hashlib
import time
from datetime import datetime

from sqlalchemy import select

from .session import async_session_factory, init_db
from .models import WorkflowModel


def generate_workflow_id(name: str) -> str:
    """Generate a unique workflow ID."""
    timestamp = int(time.time() * 1000)
    # Include name in hash to ensure uniqueness for same-millisecond calls
    hash_input = f"{timestamp}_{name}"
    hash_suffix = hashlib.sha256(hash_input.encode()).hexdigest()[:8]
    return f"wf_{timestamp}_{hash_suffix}"


EXAMPLE_WORKFLOWS = [
    {
        "name": "Fetch Random User",
        "description": "Fetches a random user from an API and extracts their info",
        "definition": {
            "nodes": [
                {
                    "name": "Start",
                    "type": "Start",
                    "parameters": {},
                    "position": {"x": 100, "y": 200},
                },
                {
                    "name": "Fetch User",
                    "type": "HttpRequest",
                    "parameters": {
                        "url": "https://randomuser.me/api/",
                        "method": "GET",
                    },
                    "position": {"x": 350, "y": 200},
                },
                {
                    "name": "Extract Data",
                    "type": "Code",
                    "parameters": {
                        "code": 'response = items[0]["json"]\nuser = response["body"]["results"][0]\nfirst_name = user["name"]["first"]\nlast_name = user["name"]["last"]\nreturn {\n    "name": first_name + " " + last_name,\n    "email": user["email"],\n    "country": user["location"]["country"]\n}'
                    },
                    "position": {"x": 600, "y": 200},
                },
            ],
            "connections": [
                {"source_node": "Start", "target_node": "Fetch User"},
                {"source_node": "Fetch User", "target_node": "Extract Data"},
            ],
            "settings": {},
        },
    },
    {
        "name": "Conditional Greeting",
        "description": "Demonstrates branching logic with If node based on time of day",
        "definition": {
            "nodes": [
                {
                    "name": "Start",
                    "type": "Start",
                    "parameters": {},
                    "position": {"x": 100, "y": 200},
                },
                {
                    "name": "Get Hour",
                    "type": "Code",
                    "parameters": {
                        "code": 'hour = datetime.now().hour\nreturn {"hour": hour, "is_morning": hour < 12}'
                    },
                    "position": {"x": 350, "y": 200},
                },
                {
                    "name": "Check Time",
                    "type": "If",
                    "parameters": {"condition": "{{ $json.is_morning }}"},
                    "position": {"x": 600, "y": 200},
                },
                {
                    "name": "Morning Message",
                    "type": "Set",
                    "parameters": {
                        "mode": "json",
                        "jsonData": '{"greeting": "Good morning!", "emoji": "sunrise", "period": "AM"}',
                        "keepOnlySet": True,
                    },
                    "position": {"x": 850, "y": 100},
                },
                {
                    "name": "Evening Message",
                    "type": "Set",
                    "parameters": {
                        "mode": "json",
                        "jsonData": '{"greeting": "Good evening!", "emoji": "moon", "period": "PM"}',
                        "keepOnlySet": True,
                    },
                    "position": {"x": 850, "y": 300},
                },
            ],
            "connections": [
                {"source_node": "Start", "target_node": "Get Hour"},
                {"source_node": "Get Hour", "target_node": "Check Time"},
                {
                    "source_node": "Check Time",
                    "target_node": "Morning Message",
                    "source_output": "true",
                },
                {
                    "source_node": "Check Time",
                    "target_node": "Evening Message",
                    "source_output": "false",
                },
            ],
            "settings": {},
        },
    },
    {
        "name": "Data Transform Pipeline",
        "description": "Shows data transformation: generate data, filter, and aggregate",
        "definition": {
            "nodes": [
                {
                    "name": "Start",
                    "type": "Start",
                    "parameters": {},
                    "position": {"x": 100, "y": 200},
                },
                {
                    "name": "Generate Sales Data",
                    "type": "Code",
                    "parameters": {
                        "code": '# Sample sales data\nsales = [\n    {"id": 1, "product": "Widget", "region": "North", "amount": 250, "quantity": 2},\n    {"id": 2, "product": "Gadget", "region": "South", "amount": 750, "quantity": 5},\n    {"id": 3, "product": "Gizmo", "region": "East", "amount": 320, "quantity": 3},\n    {"id": 4, "product": "Widget", "region": "West", "amount": 890, "quantity": 8},\n    {"id": 5, "product": "Doohickey", "region": "North", "amount": 150, "quantity": 1},\n    {"id": 6, "product": "Gadget", "region": "East", "amount": 620, "quantity": 4},\n    {"id": 7, "product": "Gizmo", "region": "South", "amount": 980, "quantity": 9},\n    {"id": 8, "product": "Widget", "region": "West", "amount": 410, "quantity": 3}\n]\nreturn {"sales": sales, "total_records": len(sales)}'
                    },
                    "position": {"x": 350, "y": 200},
                },
                {
                    "name": "Filter High Value",
                    "type": "Code",
                    "parameters": {
                        "code": 'sales = items[0]["json"]["sales"]\nhigh_value = [s for s in sales if s["amount"] > 500]\nreturn {"high_value_sales": high_value, "count": len(high_value)}'
                    },
                    "position": {"x": 600, "y": 200},
                },
                {
                    "name": "Aggregate Stats",
                    "type": "Code",
                    "parameters": {
                        "code": 'sales = items[0]["json"]["high_value_sales"]\nif not sales:\n    return {"message": "No high value sales found"}\ntotal = sum(s["amount"] for s in sales)\navg = total / len(sales)\nby_region = {}\nfor s in sales:\n    region = s["region"]\n    by_region[region] = by_region.get(region, 0) + s["amount"]\nreturn {\n    "total_high_value": total,\n    "average_amount": round(avg, 2),\n    "count": len(sales),\n    "by_region": by_region\n}'
                    },
                    "position": {"x": 850, "y": 200},
                },
            ],
            "connections": [
                {"source_node": "Start", "target_node": "Generate Sales Data"},
                {"source_node": "Generate Sales Data", "target_node": "Filter High Value"},
                {"source_node": "Filter High Value", "target_node": "Aggregate Stats"},
            ],
            "settings": {},
        },
    },
    {
        "name": "Multi-API Aggregator",
        "description": "Fetches data from multiple APIs in parallel and combines results",
        "definition": {
            "nodes": [
                {
                    "name": "Start",
                    "type": "Start",
                    "parameters": {},
                    "position": {"x": 100, "y": 250},
                },
                {
                    "name": "Fetch Cat Fact",
                    "type": "HttpRequest",
                    "parameters": {
                        "url": "https://catfact.ninja/fact",
                        "method": "GET",
                    },
                    "position": {"x": 350, "y": 150},
                },
                {
                    "name": "Fetch Joke",
                    "type": "HttpRequest",
                    "parameters": {
                        "url": "https://official-joke-api.appspot.com/random_joke",
                        "method": "GET",
                    },
                    "position": {"x": 350, "y": 350},
                },
                {
                    "name": "Wait For Both",
                    "type": "Merge",
                    "parameters": {"mode": "wait_all", "expected_inputs": 2},
                    "position": {"x": 600, "y": 250},
                },
                {
                    "name": "Combine Results",
                    "type": "Code",
                    "parameters": {
                        "code": '# Get data from both API calls via node_data\ncat_data = node_data.get("Fetch Cat Fact", {}).get("json", {})\njoke_data = node_data.get("Fetch Joke", {}).get("json", {})\n\ncat_body = cat_data.get("body", {})\njoke_body = joke_data.get("body", {})\n\nreturn {\n    "cat_fact": cat_body.get("fact", "No fact available"),\n    "joke": {\n        "setup": joke_body.get("setup", "No joke available"),\n        "punchline": joke_body.get("punchline", "")\n    }\n}'
                    },
                    "position": {"x": 850, "y": 250},
                },
            ],
            "connections": [
                {"source_node": "Start", "target_node": "Fetch Cat Fact"},
                {"source_node": "Start", "target_node": "Fetch Joke"},
                {"source_node": "Fetch Cat Fact", "target_node": "Wait For Both"},
                {"source_node": "Fetch Joke", "target_node": "Wait For Both"},
                {"source_node": "Wait For Both", "target_node": "Combine Results"},
            ],
            "settings": {},
        },
    },
]


async def seed_workflows() -> None:
    """Seed the database with example workflows."""
    await init_db()

    async with async_session_factory() as session:
        # Check if workflows already exist
        result = await session.execute(select(WorkflowModel))
        existing = result.scalars().all()
        existing_names = {w.name for w in existing}

        added = 0
        for workflow_data in EXAMPLE_WORKFLOWS:
            if workflow_data["name"] in existing_names:
                print(f"Skipping '{workflow_data['name']}' - already exists")
                continue

            workflow = WorkflowModel(
                id=generate_workflow_id(workflow_data["name"]),
                name=workflow_data["name"],
                description=workflow_data["description"],
                active=False,
                definition=workflow_data["definition"],
                created_at=datetime.now(),
                updated_at=datetime.now(),
            )
            session.add(workflow)
            added += 1
            print(f"Added workflow: {workflow_data['name']}")

        await session.commit()
        print(f"\nSeeding complete. Added {added} workflows.")


def main() -> None:
    """Run the seed script."""
    asyncio.run(seed_workflows())


if __name__ == "__main__":
    main()
