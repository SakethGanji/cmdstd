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
        "name": "Weather Alert Monitor",
        "description": "Checks for active weather alerts and categorizes by severity",
        "definition": {
            "nodes": [
                {
                    "name": "Start",
                    "type": "Start",
                    "parameters": {},
                    "position": {"x": 100, "y": 200},
                },
                {
                    "name": "Fetch DC Alerts",
                    "type": "HttpRequest",
                    "parameters": {
                        "url": "https://api.weather.gov/alerts/active?area=DC",
                        "method": "GET",
                    },
                    "position": {"x": 350, "y": 200},
                },
                {
                    "name": "Check Alerts Exist",
                    "type": "Code",
                    "parameters": {
                        "code": 'response = items[0]["json"]\nfeatures = response["body"].get("features", [])\nreturn {"has_alerts": len(features) > 0, "alert_count": len(features), "features": features}'
                    },
                    "position": {"x": 600, "y": 200},
                },
                {
                    "name": "Has Alerts?",
                    "type": "If",
                    "parameters": {"condition": "{{ $json.has_alerts }}"},
                    "position": {"x": 850, "y": 200},
                },
                {
                    "name": "Process Alerts",
                    "type": "Code",
                    "parameters": {
                        "code": 'features = items[0]["json"]["features"]\nalerts = []\nfor f in features[:5]:\n    props = f.get("properties", {})\n    alerts.append({\n        "event": props.get("event", "Unknown"),\n        "severity": props.get("severity", "Unknown"),\n        "headline": props.get("headline", ""),\n        "areas": props.get("areaDesc", "")\n    })\nreturn {"alerts": alerts, "total": len(features)}'
                    },
                    "position": {"x": 1100, "y": 100},
                },
                {
                    "name": "No Alerts",
                    "type": "Set",
                    "parameters": {
                        "mode": "json",
                        "jsonData": '{"message": "No active weather alerts for DC", "status": "all_clear"}',
                        "keepOnlySet": True,
                    },
                    "position": {"x": 1100, "y": 300},
                },
            ],
            "connections": [
                {"source_node": "Start", "target_node": "Fetch DC Alerts"},
                {"source_node": "Fetch DC Alerts", "target_node": "Check Alerts Exist"},
                {"source_node": "Check Alerts Exist", "target_node": "Has Alerts?"},
                {
                    "source_node": "Has Alerts?",
                    "target_node": "Process Alerts",
                    "source_output": "true",
                },
                {
                    "source_node": "Has Alerts?",
                    "target_node": "No Alerts",
                    "source_output": "false",
                },
            ],
            "settings": {},
        },
    },
    {
        "name": "Near-Earth Asteroid Tracker",
        "description": "Fetches asteroid data from NASA and identifies potentially hazardous objects",
        "definition": {
            "nodes": [
                {
                    "name": "Start",
                    "type": "Start",
                    "parameters": {},
                    "position": {"x": 100, "y": 200},
                },
                {
                    "name": "Fetch Asteroids",
                    "type": "HttpRequest",
                    "parameters": {
                        "url": "https://api.nasa.gov/neo/rest/v1/neo/browse?api_key=DEMO_KEY",
                        "method": "GET",
                    },
                    "position": {"x": 350, "y": 200},
                },
                {
                    "name": "Parse Asteroid Data",
                    "type": "Code",
                    "parameters": {
                        "code": 'response = items[0]["json"]\nasteroids = response["body"].get("near_earth_objects", [])\nparsed = []\nfor a in asteroids[:10]:\n    diameter = a.get("estimated_diameter", {}).get("kilometers", {})\n    parsed.append({\n        "name": a.get("name", "Unknown"),\n        "id": a.get("id", ""),\n        "is_hazardous": a.get("is_potentially_hazardous_asteroid", False),\n        "diameter_km_min": round(diameter.get("estimated_diameter_min", 0), 3),\n        "diameter_km_max": round(diameter.get("estimated_diameter_max", 0), 3),\n        "first_observed": a.get("orbital_data", {}).get("first_observation_date", "Unknown")\n    })\nreturn {"asteroids": parsed, "total_fetched": len(parsed)}'
                    },
                    "position": {"x": 600, "y": 200},
                },
                {
                    "name": "Filter Hazardous",
                    "type": "Code",
                    "parameters": {
                        "code": 'asteroids = items[0]["json"]["asteroids"]\nhazardous = [a for a in asteroids if a["is_hazardous"]]\nsafe = [a for a in asteroids if not a["is_hazardous"]]\nreturn {\n    "hazardous_count": len(hazardous),\n    "safe_count": len(safe),\n    "hazardous_asteroids": hazardous,\n    "largest_hazardous": max(hazardous, key=lambda x: x["diameter_km_max"]) if hazardous else None\n}'
                    },
                    "position": {"x": 850, "y": 200},
                },
            ],
            "connections": [
                {"source_node": "Start", "target_node": "Fetch Asteroids"},
                {"source_node": "Fetch Asteroids", "target_node": "Parse Asteroid Data"},
                {"source_node": "Parse Asteroid Data", "target_node": "Filter Hazardous"},
            ],
            "settings": {},
        },
    },
    {
        "name": "Space and Weather Dashboard",
        "description": "Combines NASA space data with weather alerts for a comprehensive dashboard",
        "definition": {
            "nodes": [
                {
                    "name": "Start",
                    "type": "Start",
                    "parameters": {},
                    "position": {"x": 100, "y": 250},
                },
                {
                    "name": "Fetch Space Picture",
                    "type": "HttpRequest",
                    "parameters": {
                        "url": "https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY",
                        "method": "GET",
                    },
                    "position": {"x": 350, "y": 100},
                },
                {
                    "name": "Fetch Weather Alerts",
                    "type": "HttpRequest",
                    "parameters": {
                        "url": "https://api.weather.gov/alerts/active?area=DC",
                        "method": "GET",
                    },
                    "position": {"x": 350, "y": 250},
                },
                {
                    "name": "Fetch Asteroids",
                    "type": "HttpRequest",
                    "parameters": {
                        "url": "https://api.nasa.gov/neo/rest/v1/neo/browse?api_key=DEMO_KEY",
                        "method": "GET",
                    },
                    "position": {"x": 350, "y": 400},
                },
                {
                    "name": "Wait For All",
                    "type": "Merge",
                    "parameters": {"mode": "wait_all", "expected_inputs": 3},
                    "position": {"x": 600, "y": 250},
                },
                {
                    "name": "Build Dashboard",
                    "type": "Code",
                    "parameters": {
                        "code": '# Get data from all API calls\napod = node_data.get("Fetch Space Picture", {}).get("json", {}).get("body", {})\nalerts = node_data.get("Fetch Weather Alerts", {}).get("json", {}).get("body", {}).get("features", [])\nasteroids = node_data.get("Fetch Asteroids", {}).get("json", {}).get("body", {}).get("near_earth_objects", [])\n\n# Process alerts\nactive_alerts = [{\n    "event": a.get("properties", {}).get("event", "Unknown"),\n    "severity": a.get("properties", {}).get("severity", "Unknown")\n} for a in alerts[:3]]\n\n# Count hazardous asteroids\nhazardous = sum(1 for a in asteroids if a.get("is_potentially_hazardous_asteroid", False))\n\nreturn {\n    "space_picture": {\n        "title": apod.get("title", "No image today"),\n        "date": apod.get("date", "Unknown")\n    },\n    "weather": {\n        "alert_count": len(alerts),\n        "alerts": active_alerts,\n        "status": "warnings" if alerts else "clear"\n    },\n    "asteroids": {\n        "tracked": len(asteroids),\n        "hazardous": hazardous\n    },\n    "dashboard_generated": "success"\n}'
                    },
                    "position": {"x": 850, "y": 250},
                },
            ],
            "connections": [
                {"source_node": "Start", "target_node": "Fetch Space Picture"},
                {"source_node": "Start", "target_node": "Fetch Weather Alerts"},
                {"source_node": "Start", "target_node": "Fetch Asteroids"},
                {"source_node": "Fetch Space Picture", "target_node": "Wait For All"},
                {"source_node": "Fetch Weather Alerts", "target_node": "Wait For All"},
                {"source_node": "Fetch Asteroids", "target_node": "Wait For All"},
                {"source_node": "Wait For All", "target_node": "Build Dashboard"},
            ],
            "settings": {},
        },
    },
    {
        "name": "Support Ticket Router",
        "description": "Routes support tickets to different queues based on priority using the Switch node",
        "definition": {
            "nodes": [
                {
                    "name": "Start",
                    "type": "Start",
                    "parameters": {},
                    "position": {"x": 100, "y": 300},
                },
                {
                    "name": "Sample Tickets",
                    "type": "Code",
                    "parameters": {
                        "code": """# Generate sample support tickets with different priorities
tickets = [
    {"id": 1, "title": "Server down", "priority": "critical", "customer": "Acme Corp"},
    {"id": 2, "title": "Login issues", "priority": "high", "customer": "TechStart"},
    {"id": 3, "title": "Feature request", "priority": "low", "customer": "BigCo"},
    {"id": 4, "title": "Data export bug", "priority": "high", "customer": "DataFlow"},
    {"id": 5, "title": "UI glitch", "priority": "medium", "customer": "DesignHub"},
    {"id": 6, "title": "API timeout", "priority": "critical", "customer": "CloudNet"},
    {"id": 7, "title": "Documentation update", "priority": "low", "customer": "DevTeam"},
    {"id": 8, "title": "Password reset", "priority": "medium", "customer": "SecureCo"},
]
# Return as multiple items so Switch processes each one
return [{"ticket": t} for t in tickets]"""
                    },
                    "position": {"x": 350, "y": 300},
                },
                {
                    "name": "Route by Priority",
                    "type": "Switch",
                    "parameters": {
                        "numberOfOutputs": 3,
                        "mode": "rules",
                        "rules": [
                            {
                                "output": 0,
                                "field": "ticket.priority",
                                "operation": "equals",
                                "value": "critical",
                            },
                            {
                                "output": 1,
                                "field": "ticket.priority",
                                "operation": "equals",
                                "value": "high",
                            },
                            {
                                "output": 2,
                                "field": "ticket.priority",
                                "operation": "equals",
                                "value": "medium",
                            },
                        ],
                    },
                    # outputStrategy tells frontend how to compute dynamic outputs on load
                    "outputStrategy": {
                        "type": "dynamicFromParameter",
                        "parameter": "numberOfOutputs",
                        "addFallback": True,
                    },
                    "position": {"x": 650, "y": 300},
                },
                {
                    "name": "Critical Queue",
                    "type": "Set",
                    "parameters": {
                        "mode": "manual",
                        "assignments": [
                            {"name": "queue", "value": "critical"},
                            {"name": "sla_minutes", "value": "15"},
                            {"name": "escalate_to", "value": "on-call-engineer"},
                        ],
                    },
                    "position": {"x": 950, "y": 100},
                },
                {
                    "name": "High Priority Queue",
                    "type": "Set",
                    "parameters": {
                        "mode": "manual",
                        "assignments": [
                            {"name": "queue", "value": "high_priority"},
                            {"name": "sla_minutes", "value": "60"},
                            {"name": "escalate_to", "value": "senior-support"},
                        ],
                    },
                    "position": {"x": 950, "y": 250},
                },
                {
                    "name": "Medium Priority Queue",
                    "type": "Set",
                    "parameters": {
                        "mode": "manual",
                        "assignments": [
                            {"name": "queue", "value": "standard"},
                            {"name": "sla_minutes", "value": "240"},
                            {"name": "escalate_to", "value": "support-team"},
                        ],
                    },
                    "position": {"x": 950, "y": 400},
                },
                {
                    "name": "Low Priority Queue",
                    "type": "Set",
                    "parameters": {
                        "mode": "manual",
                        "assignments": [
                            {"name": "queue", "value": "backlog"},
                            {"name": "sla_minutes", "value": "1440"},
                            {"name": "escalate_to", "value": "none"},
                        ],
                    },
                    "position": {"x": 950, "y": 550},
                },
            ],
            "connections": [
                {"source_node": "Start", "target_node": "Sample Tickets"},
                {"source_node": "Sample Tickets", "target_node": "Route by Priority"},
                {
                    "source_node": "Route by Priority",
                    "target_node": "Critical Queue",
                    "source_output": "output0",
                },
                {
                    "source_node": "Route by Priority",
                    "target_node": "High Priority Queue",
                    "source_output": "output1",
                },
                {
                    "source_node": "Route by Priority",
                    "target_node": "Medium Priority Queue",
                    "source_output": "output2",
                },
                {
                    "source_node": "Route by Priority",
                    "target_node": "Low Priority Queue",
                    "source_output": "fallback",
                },
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
