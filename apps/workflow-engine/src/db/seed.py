"""Seed database with example workflows."""

from __future__ import annotations

import asyncio
import hashlib
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
    # 1. USER PROFILE API - Fetches user data from external API
    # ========================================
    {
        "name": "User Profile API",
        "description": "API that fetches user profile from JSONPlaceholder, enriches with posts count. POST with {\"user_id\": 1}",
        "active": True,
        "definition": {
            "nodes": [
                {
                    "name": "Webhook",
                    "type": "Webhook",
                    "parameters": {"method": "POST"},
                    "position": {"x": 100, "y": 200},
                },
                {
                    "name": "Fetch User",
                    "type": "HttpRequest",
                    "parameters": {
                        "url": "https://jsonplaceholder.typicode.com/users/{{ $json.body.user_id }}",
                        "method": "GET",
                    },
                    "position": {"x": 350, "y": 200},
                },
                {
                    "name": "Fetch Posts",
                    "type": "HttpRequest",
                    "parameters": {
                        "url": "https://jsonplaceholder.typicode.com/posts?userId={{ $node[\"Webhook\"].json.body.user_id }}",
                        "method": "GET",
                    },
                    "position": {"x": 600, "y": 200},
                },
                {
                    "name": "Build Response",
                    "type": "Code",
                    "parameters": {
                        "code": """# Get data from previous nodes
user = node_data["Fetch User"]["json"].get("body", {})
posts = node_data["Fetch Posts"]["json"].get("body", [])

# Build enriched profile
return {
    "profile": {
        "id": user.get("id"),
        "name": user.get("name"),
        "email": user.get("email"),
        "company": user.get("company", {}).get("name"),
        "city": user.get("address", {}).get("city"),
    },
    "stats": {
        "total_posts": len(posts) if isinstance(posts, list) else 0,
        "recent_post": posts[0].get("title") if posts else None,
    }
}"""
                    },
                    "position": {"x": 850, "y": 200},
                },
                {
                    "name": "Send Response",
                    "type": "RespondToWebhook",
                    "parameters": {
                        "statusCode": "200",
                        "responseMode": "lastNode",
                        "contentType": "application/json",
                        "wrapResponse": True,
                    },
                    "position": {"x": 1100, "y": 200},
                },
            ],
            "connections": [
                {"source_node": "Webhook", "target_node": "Fetch User"},
                {"source_node": "Fetch User", "target_node": "Fetch Posts"},
                {"source_node": "Fetch Posts", "target_node": "Build Response"},
                {"source_node": "Build Response", "target_node": "Send Response"},
            ],
            "settings": {},
        },
    },
    # ========================================
    # 2. ECHO API - Simple request/response example
    # ========================================
    {
        "name": "Echo API",
        "description": "Simple API that echoes back transformed input. POST with any JSON body.",
        "active": True,
        "definition": {
            "nodes": [
                {
                    "name": "Webhook",
                    "type": "Webhook",
                    "parameters": {"method": "POST"},
                    "position": {"x": 100, "y": 200},
                },
                {
                    "name": "Transform",
                    "type": "Set",
                    "parameters": {
                        "mode": "manual",
                        "keepOnlySet": True,
                        "fields": [
                            {"name": "received", "value": "{{ $json.body }}"},
                            {"name": "timestamp", "value": "{{ $json.triggeredAt }}"},
                            {"name": "method", "value": "{{ $json.method }}"},
                        ],
                    },
                    "position": {"x": 350, "y": 200},
                },
                {
                    "name": "Respond",
                    "type": "RespondToWebhook",
                    "parameters": {
                        "statusCode": "200",
                        "responseMode": "lastNode",
                        "contentType": "application/json",
                        "wrapResponse": True,
                    },
                    "position": {"x": 600, "y": 200},
                },
            ],
            "connections": [
                {"source_node": "Webhook", "target_node": "Transform"},
                {"source_node": "Transform", "target_node": "Respond"},
            ],
            "settings": {},
        },
    },
    # ========================================
    # 3. RANDOM JOKE API - Fetches and formats external data
    # ========================================
    {
        "name": "Random Joke API",
        "description": "Fetches a random joke from an external API and returns it formatted. GET request, no body needed.",
        "active": True,
        "definition": {
            "nodes": [
                {
                    "name": "Webhook",
                    "type": "Webhook",
                    "parameters": {"method": "GET"},
                    "position": {"x": 100, "y": 200},
                },
                {
                    "name": "Fetch Joke",
                    "type": "HttpRequest",
                    "parameters": {
                        "url": "https://official-joke-api.appspot.com/random_joke",
                        "method": "GET",
                    },
                    "position": {"x": 350, "y": 200},
                },
                {
                    "name": "Format Joke",
                    "type": "Set",
                    "parameters": {
                        "mode": "manual",
                        "keepOnlySet": True,
                        "fields": [
                            {"name": "setup", "value": "{{ $json.body.setup }}"},
                            {"name": "punchline", "value": "{{ $json.body.punchline }}"},
                            {"name": "type", "value": "{{ $json.body.type }}"},
                        ],
                    },
                    "position": {"x": 600, "y": 200},
                },
                {
                    "name": "Respond",
                    "type": "RespondToWebhook",
                    "parameters": {
                        "statusCode": "200",
                        "responseMode": "lastNode",
                        "contentType": "application/json",
                        "wrapResponse": True,
                    },
                    "position": {"x": 850, "y": 200},
                },
            ],
            "connections": [
                {"source_node": "Webhook", "target_node": "Fetch Joke"},
                {"source_node": "Fetch Joke", "target_node": "Format Joke"},
                {"source_node": "Format Joke", "target_node": "Respond"},
            ],
            "settings": {},
        },
    },
    # ========================================
    # 4. EXCEL SAMPLER API - Upload Excel, get sampled rows
    # ========================================
    {
        "name": "Excel Sampler API",
        "description": "Upload a base64-encoded Excel file and get sampled rows. POST with {\"file\": \"<base64>\", \"sample_size\": 10, \"mode\": \"random\"}",
        "active": True,
        "definition": {
            "nodes": [
                {
                    "name": "Webhook",
                    "type": "Webhook",
                    "parameters": {"method": "POST"},
                    "position": {"x": 100, "y": 200},
                },
                {
                    "name": "Parse and Sample",
                    "type": "Code",
                    "parameters": {
                        "code": """# Modules available: pd (pandas), io, base64, random, json, math, re, datetime

# Get inputs from webhook body
data = node_data["Webhook"]["json"].get("body", {})
sample_size = data.get("sample_size", 10)
mode = data.get("mode", "random")

# Handle both file upload (multipart) and base64 JSON formats
file_data = data.get("file")
if not file_data:
    return {"error": "No file provided. Upload Excel file or send base64 in 'file' field."}

# Check if it's a file upload (dict with content) or direct base64 string
if isinstance(file_data, dict):
    file_b64 = file_data.get("content")
    filename = file_data.get("filename", "unknown")
else:
    file_b64 = file_data
    filename = "uploaded.xlsx"

if not file_b64:
    return {"error": "No file content found."}

try:
    # Decode and parse Excel
    file_bytes = base64.b64decode(file_b64)
    df = pd.read_excel(io.BytesIO(file_bytes))
    rows = df.to_dict("records")

    # Sample based on mode
    total = len(rows)
    sample_size = min(sample_size, total)

    if mode == "first":
        sampled = rows[:sample_size]
    elif mode == "last":
        sampled = rows[-sample_size:]
    else:  # random
        sampled = random.sample(rows, sample_size) if rows else []

    return {
        "filename": filename,
        "sampled": sampled,
        "total_rows": total,
        "sampled_count": len(sampled),
        "columns": list(df.columns),
        "mode": mode
    }
except Exception as e:
    return {"error": str(e)}
"""
                    },
                    "position": {"x": 400, "y": 200},
                },
                {
                    "name": "Respond",
                    "type": "RespondToWebhook",
                    "parameters": {
                        "statusCode": "200",
                        "responseMode": "lastNode",
                        "contentType": "application/json",
                        "wrapResponse": True,
                    },
                    "position": {"x": 700, "y": 200},
                },
            ],
            "connections": [
                {"source_node": "Webhook", "target_node": "Parse and Sample"},
                {"source_node": "Parse and Sample", "target_node": "Respond"},
            ],
            "settings": {},
        },
    },
    # ========================================
    # 5. MOCK BANK STATEMENTS API - Generate mock bank statements
    # ========================================
    {
        "name": "Mock Bank Statements API",
        "description": "Get mock bank statements for an account. POST with {\"account_id\": \"123456\", \"days\": 30}",
        "active": True,
        "definition": {
            "nodes": [
                {
                    "name": "Webhook",
                    "type": "Webhook",
                    "parameters": {"method": "POST"},
                    "position": {"x": 100, "y": 200},
                },
                {
                    "name": "Generate Statements",
                    "type": "Code",
                    "parameters": {
                        "code": """# Get inputs
data = node_data["Webhook"]["json"].get("body", {})
account_id = str(data.get("account_id", "000000"))
days = data.get("days", 30)

# Mask account number
masked_account = "****" + account_id[-4:] if len(account_id) >= 4 else "****" + account_id

# Generate mock transactions
merchants = ["Amazon", "Walmart", "Starbucks", "Shell Gas", "Netflix", "Uber", "Target", "Whole Foods", "Electric Co", "Water Utility"]
categories = ["Shopping", "Shopping", "Food & Drink", "Gas", "Entertainment", "Transport", "Shopping", "Groceries", "Utilities", "Utilities"]

transactions = []
balance = round(random.uniform(3000, 8000), 2)
running_balance = balance

for i in range(min(days, 50)):
    merchant_idx = random.randint(0, len(merchants) - 1)
    is_credit = random.random() < 0.2  # 20% chance of credit

    if is_credit:
        amount = round(random.uniform(500, 3000), 2)
        running_balance += amount
        tx_type = "credit"
        desc = ["Direct Deposit", "Transfer In", "Refund", "Interest"][random.randint(0, 3)]
    else:
        amount = round(random.uniform(5, 200), 2)
        running_balance -= amount
        tx_type = "debit"
        desc = merchants[merchant_idx]

    transactions.append({
        "id": f"txn_{1000 + i}",
        "date": f"2026-01-{max(1, 21 - i):02d}",
        "description": desc,
        "category": categories[merchant_idx] if tx_type == "debit" else "Income",
        "amount": amount if is_credit else -amount,
        "type": tx_type,
        "balance": round(running_balance, 2)
    })

# Calculate summary
total_credits = sum(t["amount"] for t in transactions if t["amount"] > 0)
total_debits = abs(sum(t["amount"] for t in transactions if t["amount"] < 0))

return {
    "account": {
        "number": masked_account,
        "type": "checking",
        "holder": "Account Holder",
        "current_balance": round(running_balance, 2),
        "available_balance": round(running_balance - 50, 2)
    },
    "statement_period": {
        "from": f"2026-01-01",
        "to": f"2026-01-21"
    },
    "transactions": transactions,
    "summary": {
        "total_credits": round(total_credits, 2),
        "total_debits": round(total_debits, 2),
        "transaction_count": len(transactions)
    }
}
"""
                    },
                    "position": {"x": 400, "y": 200},
                },
                {
                    "name": "Respond",
                    "type": "RespondToWebhook",
                    "parameters": {
                        "statusCode": "200",
                        "responseMode": "lastNode",
                        "contentType": "application/json",
                        "wrapResponse": True,
                    },
                    "position": {"x": 700, "y": 200},
                },
            ],
            "connections": [
                {"source_node": "Webhook", "target_node": "Generate Statements"},
                {"source_node": "Generate Statements", "target_node": "Respond"},
            ],
            "settings": {},
        },
    },
]


async def seed_workflows(reset: bool = False) -> None:
    """Seed the database with example workflows.

    Args:
        reset: If True, delete all existing workflows before seeding.
               Default is False to preserve user-created workflows.
    """
    await init_db()

    async with async_session_factory() as session:
        if reset:
            # Delete all existing workflows
            await session.execute(delete(WorkflowModel))
            await session.commit()
            print("Cleared existing workflows.")

        # Get existing workflow names to avoid duplicates
        result = await session.execute(select(WorkflowModel.name))
        existing_names = {row[0] for row in result.fetchall()}

        added = 0
        skipped = 0
        for workflow_data in EXAMPLE_WORKFLOWS:
            # Skip if workflow already exists
            if workflow_data["name"] in existing_names:
                skipped += 1
                continue

            # Use fixed ID if provided, otherwise generate one
            workflow_id = workflow_data.get("id") or generate_workflow_id(workflow_data["name"])

            workflow = WorkflowModel(
                id=workflow_id,
                name=workflow_data["name"],
                description=workflow_data.get("description", ""),
                active=workflow_data.get("active", False),
                definition=workflow_data["definition"],
                created_at=datetime.now(),
                updated_at=datetime.now(),
            )
            session.add(workflow)
            added += 1
            status = "ACTIVE" if workflow_data.get("active") else "inactive"
            print(f"Added [{status}]: {workflow_data['name']}")

        await session.commit()
        if skipped > 0:
            print(f"\nSeeding complete. Added {added} workflows, skipped {skipped} existing.")
        else:
            print(f"\nSeeding complete. Added {added} workflows.")


def main() -> None:
    """Run the seed script."""
    asyncio.run(seed_workflows(reset=True))


if __name__ == "__main__":
    main()
