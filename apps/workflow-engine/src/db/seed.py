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
    # SAMPLING WORKFLOWS
    # ========================================
    {
        "name": "Sample CSV Data",
        "description": "Demonstrates sampling from a local CSV file. Uses the Sample node to randomly select rows from test_data.csv",
        "active": False,
        "definition": {
            "nodes": [
                {
                    "name": "Start",
                    "type": "Start",
                    "parameters": {},
                    "position": {"x": 100, "y": 200},
                },
                {
                    "name": "Sample Data",
                    "type": "Sample",
                    "parameters": {
                                                "sourceType": "file",
                        "fileLocation": "local",
                        "filePath": "/home/saketh/Projects/cmdstd/apps/analytics-service/test_data.csv",
                        "method": "random",
                        "sampleSize": 5,
                        "seed": 42,
                    },
                    "position": {"x": 350, "y": 200},
                },
                {
                    "name": "Format Output",
                    "type": "Code",
                    "parameters": {
                        "code": """# Format the sampled data for display
data = node_data["Sample Data"]["json"]

summary = f\"\"\"
Sampling Results:
- Original rows: {data['original_count']}
- Sampled rows: {data['sampled_count']}
- Method: {data['method']}

Sample Data:
\"\"\"

for i, row in enumerate(data['data'][:5], 1):
    summary += f"{i}. {row}\\n"

return {
    "summary": summary,
    "data": data['data'],
    "stats": {
        "original": data['original_count'],
        "sampled": data['sampled_count'],
        "method": data['method']
    }
}"""
                    },
                    "position": {"x": 600, "y": 200},
                },
            ],
            "connections": [
                {"source_node": "Start", "target_node": "Sample Data"},
                {"source_node": "Sample Data", "target_node": "Format Output"},
            ],
            "settings": {},
        },
    },
    {
        "name": "Stratified Sampling Demo",
        "description": "Shows stratified sampling by category. Samples proportionally from each category in the dataset.",
        "active": False,
        "definition": {
            "nodes": [
                {
                    "name": "Start",
                    "type": "Start",
                    "parameters": {},
                    "position": {"x": 100, "y": 200},
                },
                {
                    "name": "Stratified Sample",
                    "type": "Sample",
                    "parameters": {
                                                "sourceType": "file",
                        "fileLocation": "local",
                        "filePath": "/home/saketh/Projects/cmdstd/apps/analytics-service/test_data.csv",
                        "method": "stratified",
                        "stratifyColumn": "category",
                        "sampleSize": 9,
                        "seed": 42,
                    },
                    "position": {"x": 350, "y": 200},
                },
                {
                    "name": "Analyze Categories",
                    "type": "Code",
                    "parameters": {
                        "code": """# Analyze category distribution in sample
data = node_data["Stratified Sample"]["json"]

# Count by category
categories = {}
for row in data['data']:
    cat = row.get('category', 'Unknown')
    categories[cat] = categories.get(cat, 0) + 1

# Build summary
summary = f\"\"\"Stratified Sampling Results
============================
Original rows: {data['original_count']}
Sampled rows: {data['sampled_count']}
Stratify column: category

Category Distribution:
\"\"\"

for cat, count in sorted(categories.items()):
    pct = (count / data['sampled_count']) * 100
    summary += f"  {cat}: {count} rows ({pct:.1f}%)\\n"

return {
    "summary": summary,
    "category_counts": categories,
    "data": data['data']
}"""
                    },
                    "position": {"x": 600, "y": 200},
                },
            ],
            "connections": [
                {"source_node": "Start", "target_node": "Stratified Sample"},
                {"source_node": "Stratified Sample", "target_node": "Analyze Categories"},
            ],
            "settings": {},
        },
    },
    {
        "name": "Sample API Response",
        "description": "Webhook workflow that samples data from an API response. POST with {\"items\": [{\"id\": 1}, {\"id\": 2}, ...]}",
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
                    "name": "Sample Input",
                    "type": "Sample",
                    "parameters": {
                                                "sourceType": "input",
                        "dataField": "body.items",
                        "method": "random",
                        "sampleSize": 3,
                        "seed": 42,
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
                    },
                    "position": {"x": 600, "y": 200},
                },
            ],
            "connections": [
                {"source_node": "Webhook", "target_node": "Sample Input"},
                {"source_node": "Sample Input", "target_node": "Respond"},
            ],
            "settings": {},
        },
    },
    # ========================================
    # 1. APPROVAL ROUTING - Multi-level approval based on amount
    # ========================================
    {
        "name": "Approval Routing",
        "description": "Routes approval requests by amount: <$1K auto-approve, $1K-$10K manager, $10K-$100K director, >$100K executive. POST with {\"request_id\": \"REQ-001\", \"amount\": 5000, \"requester\": \"John Smith\", \"description\": \"Software license\"}",
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
                    "name": "Route by Amount",
                    "type": "Switch",
                    "parameters": {
                        "mode": "rules",
                        "numberOfOutputs": 4,
                        "rules": [
                            {"output": 0, "field": "body.amount", "operation": "lt", "value": "1000"},
                            {"output": 1, "field": "body.amount", "operation": "lt", "value": "10000"},
                            {"output": 2, "field": "body.amount", "operation": "lt", "value": "100000"},
                            {"output": 3, "field": "body.amount", "operation": "gte", "value": "100000"},
                        ],
                    },
                    "position": {"x": 350, "y": 300},
                },
                {
                    "name": "Auto Approve",
                    "type": "Set",
                    "parameters": {
                        "mode": "manual",
                        "keepOnlySet": True,
                        "fields": [
                            {"name": "request_id", "value": "{{ $json.body.request_id }}"},
                            {"name": "status", "value": "APPROVED"},
                            {"name": "approval_level", "value": "AUTO"},
                            {"name": "amount", "value": "{{ $json.body.amount }}"},
                            {"name": "message", "value": "Automatically approved - amount under $1,000"},
                        ],
                    },
                    "position": {"x": 650, "y": 100},
                },
                {
                    "name": "Manager Queue",
                    "type": "Set",
                    "parameters": {
                        "mode": "manual",
                        "keepOnlySet": True,
                        "fields": [
                            {"name": "request_id", "value": "{{ $json.body.request_id }}"},
                            {"name": "status", "value": "PENDING_APPROVAL"},
                            {"name": "approval_level", "value": "MANAGER"},
                            {"name": "amount", "value": "{{ $json.body.amount }}"},
                            {"name": "requester", "value": "{{ $json.body.requester }}"},
                            {"name": "description", "value": "{{ $json.body.description }}"},
                            {"name": "message", "value": "Routed to manager approval queue ($1K-$10K)"},
                        ],
                    },
                    "position": {"x": 650, "y": 250},
                },
                {
                    "name": "Director Queue",
                    "type": "Set",
                    "parameters": {
                        "mode": "manual",
                        "keepOnlySet": True,
                        "fields": [
                            {"name": "request_id", "value": "{{ $json.body.request_id }}"},
                            {"name": "status", "value": "PENDING_APPROVAL"},
                            {"name": "approval_level", "value": "DIRECTOR"},
                            {"name": "amount", "value": "{{ $json.body.amount }}"},
                            {"name": "requester", "value": "{{ $json.body.requester }}"},
                            {"name": "description", "value": "{{ $json.body.description }}"},
                            {"name": "message", "value": "Routed to director approval queue ($10K-$100K)"},
                        ],
                    },
                    "position": {"x": 650, "y": 400},
                },
                {
                    "name": "Executive Queue",
                    "type": "Set",
                    "parameters": {
                        "mode": "manual",
                        "keepOnlySet": True,
                        "fields": [
                            {"name": "request_id", "value": "{{ $json.body.request_id }}"},
                            {"name": "status", "value": "PENDING_APPROVAL"},
                            {"name": "approval_level", "value": "EXECUTIVE"},
                            {"name": "amount", "value": "{{ $json.body.amount }}"},
                            {"name": "requester", "value": "{{ $json.body.requester }}"},
                            {"name": "description", "value": "{{ $json.body.description }}"},
                            {"name": "message", "value": "Routed to executive approval queue (>$100K) - requires C-suite sign-off"},
                        ],
                    },
                    "position": {"x": 650, "y": 550},
                },
                {
                    "name": "Respond Auto",
                    "type": "RespondToWebhook",
                    "parameters": {
                        "statusCode": "200",
                        "responseMode": "lastNode",
                        "contentType": "application/json",
                    },
                    "position": {"x": 950, "y": 100},
                },
                {
                    "name": "Respond Manager",
                    "type": "RespondToWebhook",
                    "parameters": {
                        "statusCode": "202",
                        "responseMode": "lastNode",
                        "contentType": "application/json",
                    },
                    "position": {"x": 950, "y": 250},
                },
                {
                    "name": "Respond Director",
                    "type": "RespondToWebhook",
                    "parameters": {
                        "statusCode": "202",
                        "responseMode": "lastNode",
                        "contentType": "application/json",
                    },
                    "position": {"x": 950, "y": 400},
                },
                {
                    "name": "Respond Executive",
                    "type": "RespondToWebhook",
                    "parameters": {
                        "statusCode": "202",
                        "responseMode": "lastNode",
                        "contentType": "application/json",
                    },
                    "position": {"x": 950, "y": 550},
                },
            ],
            "connections": [
                {"source_node": "Webhook", "target_node": "Route by Amount"},
                {"source_node": "Route by Amount", "target_node": "Auto Approve", "source_output": "output0"},
                {"source_node": "Route by Amount", "target_node": "Manager Queue", "source_output": "output1"},
                {"source_node": "Route by Amount", "target_node": "Director Queue", "source_output": "output2"},
                {"source_node": "Route by Amount", "target_node": "Executive Queue", "source_output": "output3"},
                {"source_node": "Auto Approve", "target_node": "Respond Auto"},
                {"source_node": "Manager Queue", "target_node": "Respond Manager"},
                {"source_node": "Director Queue", "target_node": "Respond Director"},
                {"source_node": "Executive Queue", "target_node": "Respond Executive"},
            ],
            "settings": {},
        },
    },
    # ========================================
    # 2. CUSTOMER INQUIRY TRIAGE - AI-powered classification and routing
    # ========================================
    {
        "name": "Customer Inquiry Triage",
        "description": "AI classifies customer inquiries and routes to appropriate department. POST with {\"customer_id\": \"C-12345\", \"inquiry\": \"I need to dispute a charge on my account\"}",
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
                    "name": "Classify Inquiry",
                    "type": "LLMChat",
                    "parameters": {
                        "model": "mock",
                        "systemPrompt": """You are a customer service classifier for a bank. Classify inquiries into exactly one category.

Categories:
- DISPUTE: Charge disputes, fraud claims, unauthorized transactions
- ACCOUNT: Balance inquiries, statements, account changes
- LOAN: Loan applications, payments, rates
- CARD: Card replacement, activation, limits
- OTHER: Anything else

Respond with ONLY the category name in uppercase, nothing else.""",
                        "userMessage": "{{ $json.body.inquiry }}",
                        "temperature": 0.1,
                        "maxTokens": 50,
                    },
                    "position": {"x": 350, "y": 300},
                },
                {
                    "name": "Parse Category",
                    "type": "Code",
                    "parameters": {
                        "code": """# Extract category from LLM response
response = node_data["Classify Inquiry"]["json"].get("response", "").strip().upper()
inquiry_data = node_data["Webhook"]["json"].get("body", {})

# Map to valid categories based on keywords in response
category = "OTHER"
if "DISPUTE" in response or "FRAUD" in response:
    category = "DISPUTE"
elif "ACCOUNT" in response or "BALANCE" in response:
    category = "ACCOUNT"
elif "LOAN" in response:
    category = "LOAN"
elif "CARD" in response:
    category = "CARD"

return {
    "category": category,
    "customer_id": inquiry_data.get("customer_id"),
    "inquiry": inquiry_data.get("inquiry"),
    "raw_classification": response
}"""
                    },
                    "position": {"x": 600, "y": 300},
                },
                {
                    "name": "Route by Category",
                    "type": "Switch",
                    "parameters": {
                        "mode": "rules",
                        "numberOfOutputs": 5,
                        "rules": [
                            {"output": 0, "field": "category", "operation": "equals", "value": "DISPUTE"},
                            {"output": 1, "field": "category", "operation": "equals", "value": "ACCOUNT"},
                            {"output": 2, "field": "category", "operation": "equals", "value": "LOAN"},
                            {"output": 3, "field": "category", "operation": "equals", "value": "CARD"},
                            {"output": 4, "field": "category", "operation": "equals", "value": "OTHER"},
                        ],
                    },
                    "position": {"x": 850, "y": 300},
                },
                {
                    "name": "Dispute Team",
                    "type": "Set",
                    "parameters": {
                        "mode": "manual",
                        "keepOnlySet": True,
                        "fields": [
                            {"name": "ticket_id", "value": "TKT-{{ $randomInt }}"},
                            {"name": "customer_id", "value": "{{ $json.customer_id }}"},
                            {"name": "category", "value": "{{ $json.category }}"},
                            {"name": "inquiry", "value": "{{ $json.inquiry }}"},
                            {"name": "routed_to", "value": "Dispute Resolution Team"},
                            {"name": "priority", "value": "HIGH"},
                            {"name": "sla_hours", "value": 24},
                            {"name": "message", "value": "Dispute case created - HIGH priority, 24hr SLA"},
                        ],
                    },
                    "position": {"x": 1150, "y": 50},
                },
                {
                    "name": "Account Services",
                    "type": "Set",
                    "parameters": {
                        "mode": "manual",
                        "keepOnlySet": True,
                        "fields": [
                            {"name": "ticket_id", "value": "TKT-{{ $randomInt }}"},
                            {"name": "customer_id", "value": "{{ $json.customer_id }}"},
                            {"name": "category", "value": "{{ $json.category }}"},
                            {"name": "inquiry", "value": "{{ $json.inquiry }}"},
                            {"name": "routed_to", "value": "Account Services"},
                            {"name": "priority", "value": "MEDIUM"},
                            {"name": "sla_hours", "value": 48},
                            {"name": "message", "value": "Routed to Account Services - 48hr SLA"},
                        ],
                    },
                    "position": {"x": 1150, "y": 200},
                },
                {
                    "name": "Loan Department",
                    "type": "Set",
                    "parameters": {
                        "mode": "manual",
                        "keepOnlySet": True,
                        "fields": [
                            {"name": "ticket_id", "value": "TKT-{{ $randomInt }}"},
                            {"name": "customer_id", "value": "{{ $json.customer_id }}"},
                            {"name": "category", "value": "{{ $json.category }}"},
                            {"name": "inquiry", "value": "{{ $json.inquiry }}"},
                            {"name": "routed_to", "value": "Loan Department"},
                            {"name": "priority", "value": "MEDIUM"},
                            {"name": "sla_hours", "value": 72},
                            {"name": "message", "value": "Routed to Loan Department - 72hr SLA"},
                        ],
                    },
                    "position": {"x": 1150, "y": 350},
                },
                {
                    "name": "Card Services",
                    "type": "Set",
                    "parameters": {
                        "mode": "manual",
                        "keepOnlySet": True,
                        "fields": [
                            {"name": "ticket_id", "value": "TKT-{{ $randomInt }}"},
                            {"name": "customer_id", "value": "{{ $json.customer_id }}"},
                            {"name": "category", "value": "{{ $json.category }}"},
                            {"name": "inquiry", "value": "{{ $json.inquiry }}"},
                            {"name": "routed_to", "value": "Card Services"},
                            {"name": "priority", "value": "MEDIUM"},
                            {"name": "sla_hours", "value": 24},
                            {"name": "message", "value": "Routed to Card Services - 24hr SLA"},
                        ],
                    },
                    "position": {"x": 1150, "y": 500},
                },
                {
                    "name": "General Support",
                    "type": "Set",
                    "parameters": {
                        "mode": "manual",
                        "keepOnlySet": True,
                        "fields": [
                            {"name": "ticket_id", "value": "TKT-{{ $randomInt }}"},
                            {"name": "customer_id", "value": "{{ $json.customer_id }}"},
                            {"name": "category", "value": "{{ $json.category }}"},
                            {"name": "inquiry", "value": "{{ $json.inquiry }}"},
                            {"name": "routed_to", "value": "General Support"},
                            {"name": "priority", "value": "LOW"},
                            {"name": "sla_hours", "value": 72},
                            {"name": "message", "value": "Routed to General Support - 72hr SLA"},
                        ],
                    },
                    "position": {"x": 1150, "y": 650},
                },
                {
                    "name": "Respond Dispute",
                    "type": "RespondToWebhook",
                    "parameters": {
                        "statusCode": "200",
                        "responseMode": "lastNode",
                        "contentType": "application/json",
                    },
                    "position": {"x": 1450, "y": 50},
                },
                {
                    "name": "Respond Account",
                    "type": "RespondToWebhook",
                    "parameters": {
                        "statusCode": "200",
                        "responseMode": "lastNode",
                        "contentType": "application/json",
                    },
                    "position": {"x": 1450, "y": 200},
                },
                {
                    "name": "Respond Loan",
                    "type": "RespondToWebhook",
                    "parameters": {
                        "statusCode": "200",
                        "responseMode": "lastNode",
                        "contentType": "application/json",
                    },
                    "position": {"x": 1450, "y": 350},
                },
                {
                    "name": "Respond Card",
                    "type": "RespondToWebhook",
                    "parameters": {
                        "statusCode": "200",
                        "responseMode": "lastNode",
                        "contentType": "application/json",
                    },
                    "position": {"x": 1450, "y": 500},
                },
                {
                    "name": "Respond General",
                    "type": "RespondToWebhook",
                    "parameters": {
                        "statusCode": "200",
                        "responseMode": "lastNode",
                        "contentType": "application/json",
                    },
                    "position": {"x": 1450, "y": 650},
                },
            ],
            "connections": [
                {"source_node": "Webhook", "target_node": "Classify Inquiry"},
                {"source_node": "Classify Inquiry", "target_node": "Parse Category"},
                {"source_node": "Parse Category", "target_node": "Route by Category"},
                {"source_node": "Route by Category", "target_node": "Dispute Team", "source_output": "output0"},
                {"source_node": "Route by Category", "target_node": "Account Services", "source_output": "output1"},
                {"source_node": "Route by Category", "target_node": "Loan Department", "source_output": "output2"},
                {"source_node": "Route by Category", "target_node": "Card Services", "source_output": "output3"},
                {"source_node": "Route by Category", "target_node": "General Support", "source_output": "output4"},
                {"source_node": "Dispute Team", "target_node": "Respond Dispute"},
                {"source_node": "Account Services", "target_node": "Respond Account"},
                {"source_node": "Loan Department", "target_node": "Respond Loan"},
                {"source_node": "Card Services", "target_node": "Respond Card"},
                {"source_node": "General Support", "target_node": "Respond General"},
            ],
            "settings": {},
        },
    },
    # ========================================
    # 3. ALERT ENRICHMENT - Risk alert with context and AI summary
    # ========================================
    {
        "name": "Alert Enrichment",
        "description": "Enriches risk alerts with transaction context and AI summary. POST with {\"alert_id\": \"ALT-001\", \"account_id\": \"ACC-12345\", \"alert_type\": \"unusual_activity\", \"details\": \"Multiple large transactions in short period\"}",
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
                    "name": "Get Account Context",
                    "type": "Code",
                    "parameters": {
                        "code": """# Simulate fetching account context (in production, this would call internal APIs)
alert = node_data["Webhook"]["json"].get("body", {})
account_id = alert.get("account_id", "UNKNOWN")

# Mock account data
account_context = {
    "account_id": account_id,
    "account_type": "Premium Checking",
    "customer_since": "2019-03-15",
    "risk_score": 72,
    "average_monthly_balance": 45000,
    "typical_transaction_count": 45,
    "recent_transactions": [
        {"date": "2026-01-21", "amount": -15000, "description": "Wire Transfer", "merchant": "INTL WIRE"},
        {"date": "2026-01-21", "amount": -8500, "description": "Wire Transfer", "merchant": "INTL WIRE"},
        {"date": "2026-01-20", "amount": -12000, "description": "ACH Transfer", "merchant": "External Account"},
        {"date": "2026-01-20", "amount": 50000, "description": "Deposit", "merchant": "Direct Deposit"},
        {"date": "2026-01-19", "amount": -250, "description": "Purchase", "merchant": "Amazon"},
    ],
    "flags": ["high_value_customer", "international_activity_enabled"]
}

return {
    "alert": alert,
    "account": account_context,
    "total_recent_outflow": 35750,
    "unusual_pattern": True
}"""
                    },
                    "position": {"x": 350, "y": 200},
                },
                {
                    "name": "AI Risk Summary",
                    "type": "LLMChat",
                    "parameters": {
                        "model": "mock",
                        "systemPrompt": """You are a bank risk analyst. Analyze the alert and account context to provide a brief risk assessment.
Include: 1) Risk level (LOW/MEDIUM/HIGH/CRITICAL), 2) Key concerns, 3) Recommended action.
Be concise - max 3 sentences.""",
                        "userMessage": """Alert: {{ $json.alert.alert_type }} - {{ $json.alert.details }}
Account Risk Score: {{ $json.account.risk_score }}
Recent Outflow: ${{ $json.total_recent_outflow }}
Customer Since: {{ $json.account.customer_since }}""",
                        "temperature": 0.3,
                        "maxTokens": 200,
                    },
                    "position": {"x": 600, "y": 200},
                },
                {
                    "name": "Build Enriched Alert",
                    "type": "Code",
                    "parameters": {
                        "code": """# Combine all context into enriched alert
context = node_data["Get Account Context"]["json"]
ai_summary = node_data["AI Risk Summary"]["json"].get("response", "")

# Determine severity based on patterns
severity = "MEDIUM"
if context.get("total_recent_outflow", 0) > 30000:
    severity = "HIGH"
if context.get("account", {}).get("risk_score", 0) > 80:
    severity = "CRITICAL"

return {
    "enriched_alert": {
        "alert_id": context["alert"]["alert_id"],
        "severity": severity,
        "original_alert": context["alert"],
        "account_context": {
            "account_id": context["account"]["account_id"],
            "account_type": context["account"]["account_type"],
            "customer_tenure_years": 7,
            "risk_score": context["account"]["risk_score"],
            "flags": context["account"]["flags"]
        },
        "transaction_summary": {
            "recent_outflow": context["total_recent_outflow"],
            "transaction_count": len(context["account"]["recent_transactions"]),
            "largest_transaction": 15000
        },
        "ai_assessment": ai_summary,
        "recommended_actions": [
            "Review recent wire transfers",
            "Verify customer identity",
            "Check for authorized international activity"
        ],
        "enriched_at": "2026-01-21T14:30:00Z"
    },
    "audit_trail": {
        "workflow": "Alert Enrichment",
        "steps_completed": ["context_fetch", "ai_analysis", "severity_calc"],
        "processing_time_ms": 1250
    }
}"""
                    },
                    "position": {"x": 850, "y": 200},
                },
                {
                    "name": "Respond",
                    "type": "RespondToWebhook",
                    "parameters": {
                        "statusCode": "200",
                        "responseMode": "lastNode",
                        "contentType": "application/json",
                    },
                    "position": {"x": 1100, "y": 200},
                },
            ],
            "connections": [
                {"source_node": "Webhook", "target_node": "Get Account Context"},
                {"source_node": "Get Account Context", "target_node": "AI Risk Summary"},
                {"source_node": "AI Risk Summary", "target_node": "Build Enriched Alert"},
                {"source_node": "Build Enriched Alert", "target_node": "Respond"},
            ],
            "settings": {},
        },
    },
    # ========================================
    # 4. TRANSACTION MONITOR - Real-time transaction screening
    # ========================================
    {
        "name": "Transaction Monitor",
        "description": "Screens transactions against rules and flags suspicious activity. POST with {\"transaction_id\": \"TXN-001\", \"amount\": 15000, \"type\": \"wire\", \"destination\": \"international\", \"account_id\": \"ACC-123\"}",
        "active": True,
        "definition": {
            "nodes": [
                {
                    "name": "Webhook",
                    "type": "Webhook",
                    "parameters": {"method": "POST"},
                    "position": {"x": 100, "y": 250},
                },
                {
                    "name": "Screen Transaction",
                    "type": "Code",
                    "parameters": {
                        "code": """# Transaction screening rules
txn = node_data["Webhook"]["json"].get("body", {})
amount = txn.get("amount", 0)
txn_type = txn.get("type", "").lower()
destination = txn.get("destination", "").lower()

flags = []
risk_score = 0

# Rule 1: Large amount
if amount >= 10000:
    flags.append("LARGE_AMOUNT")
    risk_score += 30

# Rule 2: Wire transfer
if txn_type == "wire":
    flags.append("WIRE_TRANSFER")
    risk_score += 20

# Rule 3: International
if destination == "international":
    flags.append("INTERNATIONAL")
    risk_score += 25

# Rule 4: Combination risk
if amount >= 10000 and destination == "international":
    flags.append("HIGH_VALUE_INTL")
    risk_score += 25

# Determine action
if risk_score >= 75:
    action = "BLOCK"
    status = "blocked"
elif risk_score >= 50:
    action = "REVIEW"
    status = "pending_review"
else:
    action = "ALLOW"
    status = "approved"

return {
    "transaction_id": txn.get("transaction_id"),
    "amount": amount,
    "risk_score": risk_score,
    "flags": flags,
    "action": action,
    "status": status
}"""
                    },
                    "position": {"x": 350, "y": 250},
                },
                {
                    "name": "Route by Action",
                    "type": "Switch",
                    "parameters": {
                        "mode": "rules",
                        "numberOfOutputs": 3,
                        "rules": [
                            {"output": 0, "field": "action", "operation": "equals", "value": "ALLOW"},
                            {"output": 1, "field": "action", "operation": "equals", "value": "REVIEW"},
                            {"output": 2, "field": "action", "operation": "equals", "value": "BLOCK"},
                        ],
                    },
                    "position": {"x": 600, "y": 250},
                },
                {
                    "name": "Approve Transaction",
                    "type": "Set",
                    "parameters": {
                        "mode": "manual",
                        "keepOnlySet": True,
                        "fields": [
                            {"name": "transaction_id", "value": "{{ $json.transaction_id }}"},
                            {"name": "status", "value": "APPROVED"},
                            {"name": "risk_score", "value": "{{ $json.risk_score }}"},
                            {"name": "message", "value": "Transaction approved - within normal parameters"},
                        ],
                    },
                    "position": {"x": 900, "y": 100},
                },
                {
                    "name": "Queue for Review",
                    "type": "Set",
                    "parameters": {
                        "mode": "manual",
                        "keepOnlySet": True,
                        "fields": [
                            {"name": "transaction_id", "value": "{{ $json.transaction_id }}"},
                            {"name": "status", "value": "PENDING_REVIEW"},
                            {"name": "risk_score", "value": "{{ $json.risk_score }}"},
                            {"name": "flags", "value": "{{ $json.flags }}"},
                            {"name": "message", "value": "Transaction held for manual review"},
                            {"name": "review_queue", "value": "TRANSACTION_REVIEW"},
                        ],
                    },
                    "position": {"x": 900, "y": 250},
                },
                {
                    "name": "Block Transaction",
                    "type": "Set",
                    "parameters": {
                        "mode": "manual",
                        "keepOnlySet": True,
                        "fields": [
                            {"name": "transaction_id", "value": "{{ $json.transaction_id }}"},
                            {"name": "status", "value": "BLOCKED"},
                            {"name": "risk_score", "value": "{{ $json.risk_score }}"},
                            {"name": "flags", "value": "{{ $json.flags }}"},
                            {"name": "message", "value": "Transaction blocked - high risk indicators"},
                            {"name": "alert_generated", "value": True},
                        ],
                    },
                    "position": {"x": 900, "y": 400},
                },
                {
                    "name": "Respond Approved",
                    "type": "RespondToWebhook",
                    "parameters": {
                        "statusCode": "200",
                        "responseMode": "lastNode",
                        "contentType": "application/json",
                    },
                    "position": {"x": 1200, "y": 100},
                },
                {
                    "name": "Respond Review",
                    "type": "RespondToWebhook",
                    "parameters": {
                        "statusCode": "202",
                        "responseMode": "lastNode",
                        "contentType": "application/json",
                    },
                    "position": {"x": 1200, "y": 250},
                },
                {
                    "name": "Respond Blocked",
                    "type": "RespondToWebhook",
                    "parameters": {
                        "statusCode": "403",
                        "responseMode": "lastNode",
                        "contentType": "application/json",
                    },
                    "position": {"x": 1200, "y": 400},
                },
            ],
            "connections": [
                {"source_node": "Webhook", "target_node": "Screen Transaction"},
                {"source_node": "Screen Transaction", "target_node": "Route by Action"},
                {"source_node": "Route by Action", "target_node": "Approve Transaction", "source_output": "output0"},
                {"source_node": "Route by Action", "target_node": "Queue for Review", "source_output": "output1"},
                {"source_node": "Route by Action", "target_node": "Block Transaction", "source_output": "output2"},
                {"source_node": "Approve Transaction", "target_node": "Respond Approved"},
                {"source_node": "Queue for Review", "target_node": "Respond Review"},
                {"source_node": "Block Transaction", "target_node": "Respond Blocked"},
            ],
            "settings": {},
        },
    },
    # ========================================
    # 5. BANKING ASSISTANT - Interactive chatbot for demos
    # ========================================
    {
        "name": "Banking Assistant",
        "description": "Interactive AI assistant for banking inquiries. Open in UI and chat directly - great for demos!",
        "active": False,  # No webhook, uses ChatInput trigger
        "definition": {
            "nodes": [
                {
                    "name": "Chat Input",
                    "type": "ChatInput",
                    "parameters": {
                        "placeholder": "Ask me about your account, transactions, or banking services...",
                        "welcomeMessage": "Hello! I'm your Banking Assistant. I can help you with:\n\n- Account balances and statements\n- Transaction inquiries\n- Dispute filing\n- General banking questions\n\nHow can I assist you today?",
                    },
                    "position": {"x": 100, "y": 200},
                },
                {
                    "name": "Process Intent",
                    "type": "Code",
                    "parameters": {
                        "code": """# Analyze user message and prepare context
message = node_data["Chat Input"]["json"].get("message", "").lower()

# Detect intent from keywords
intent = "general"
if any(word in message for word in ["balance", "how much", "available"]):
    intent = "balance"
elif any(word in message for word in ["transaction", "history", "statement", "recent"]):
    intent = "transactions"
elif any(word in message for word in ["dispute", "fraud", "unauthorized", "wrong charge"]):
    intent = "dispute"
elif any(word in message for word in ["transfer", "send money", "pay"]):
    intent = "transfer"
elif any(word in message for word in ["loan", "mortgage", "credit"]):
    intent = "loan"

# Mock customer context (in production, would fetch from CRM)
customer_context = {
    "name": "Sarah Johnson",
    "account_number": "****4521",
    "account_type": "Premier Checking",
    "balance": 12847.52,
    "available": 12347.52,
    "pending": 500.00,
    "recent_transactions": [
        {"date": "Jan 21", "desc": "Amazon", "amount": -89.99},
        {"date": "Jan 20", "desc": "Direct Deposit - Acme Corp", "amount": 3500.00},
        {"date": "Jan 19", "desc": "Starbucks", "amount": -6.45},
        {"date": "Jan 18", "desc": "Electric Company", "amount": -142.30},
        {"date": "Jan 17", "desc": "Transfer to Savings", "amount": -500.00},
    ]
}

return {
    "original_message": node_data["Chat Input"]["json"].get("message", ""),
    "intent": intent,
    "customer": customer_context
}"""
                    },
                    "position": {"x": 350, "y": 200},
                },
                {
                    "name": "Generate Response",
                    "type": "LLMChat",
                    "parameters": {
                        "model": "mock",
                        "systemPrompt": """You are a helpful banking assistant for First National Bank.
Be friendly, professional, and concise.
Use the customer context provided to personalize responses.
For sensitive operations (transfers, disputes), always confirm details.
Never share full account numbers - always mask them.""",
                        "userMessage": """Customer: {{ $json.customer.name }} (Account: {{ $json.customer.account_number }})
Balance: ${{ $json.customer.balance }} | Available: ${{ $json.customer.available }}
Intent detected: {{ $json.intent }}

Customer message: {{ $json.original_message }}

Respond helpfully based on their intent and account context.""",
                        "temperature": 0.7,
                        "maxTokens": 500,
                    },
                    "position": {"x": 600, "y": 200},
                },
                {
                    "name": "Format Response",
                    "type": "Code",
                    "parameters": {
                        "code": """# Build a helpful response based on intent
intent = node_data["Process Intent"]["json"]["intent"]
customer = node_data["Process Intent"]["json"]["customer"]
original = node_data["Process Intent"]["json"]["original_message"]

# Build intent-specific responses
if intent == "balance":
    response = f\"\"\"Here's your account summary, {customer["name"].split()[0]}:

**{customer["account_type"]}** ({customer["account_number"]})
- Current Balance: **${customer["balance"]:,.2f}**
- Available: **${customer["available"]:,.2f}**
- Pending: ${customer["pending"]:,.2f}

Is there anything else I can help you with?\"\"\"

elif intent == "transactions":
    txn_list = "\\n".join([f"  {t['date']}: {t['desc']} ({'+' if t['amount'] > 0 else ''}{t['amount']:,.2f})"
                          for t in customer["recent_transactions"][:5]])
    response = f\"\"\"Here are your recent transactions:

{txn_list}

Would you like me to email you a full statement?\"\"\"

elif intent == "dispute":
    response = f\"\"\"I understand you'd like to file a dispute. I'm here to help.

To proceed, I'll need:
1. The transaction date and amount
2. Brief description of the issue

You can also call our Dispute Team directly at **1-800-555-0123** (24/7).

Which transaction would you like to dispute?\"\"\"

elif intent == "transfer":
    response = f\"\"\"I can help you with a transfer from your {customer["account_type"]}.

Your available balance is **${customer["available"]:,.2f}**.

Please provide:
- Destination account or recipient
- Amount to transfer

For security, transfers over $5,000 require additional verification.\"\"\"

elif intent == "loan":
    response = \"\"\"I'd be happy to help with loan information!

**Current Rates:**
- Personal Loan: 8.99% APR
- Auto Loan: 5.49% APR
- Mortgage: 6.75% APR (30-yr fixed)

As a Premier customer, you may qualify for rate discounts.

Would you like to speak with a loan specialist?\"\"\"

else:
    response = f\"\"\"Thanks for your message! I'm here to help with:

- **Account Info**: Balance, statements, account details
- **Transactions**: Recent activity, search transactions
- **Transfers**: Send money, pay bills
- **Disputes**: Report unauthorized charges
- **Loans**: Rates and applications

What would you like to know more about?\"\"\"

return {"message": response}"""
                    },
                    "position": {"x": 850, "y": 200},
                },
                {
                    "name": "Chat Output",
                    "type": "ChatOutput",
                    "parameters": {
                        "messageField": "message",
                        "messageType": "assistant",
                        "format": "markdown",
                    },
                    "position": {"x": 1100, "y": 200},
                },
            ],
            "connections": [
                {"source_node": "Chat Input", "target_node": "Process Intent"},
                {"source_node": "Process Intent", "target_node": "Generate Response"},
                {"source_node": "Generate Response", "target_node": "Format Response"},
                {"source_node": "Format Response", "target_node": "Chat Output"},
            ],
            "settings": {},
        },
    },
    # ========================================
    # 6. TRANSACTION DASHBOARD - Visual HTML output for demos
    # ========================================
    {
        "name": "Transaction Dashboard",
        "description": "Screens a transaction and shows a visual dashboard. POST with {\"transaction_id\": \"TXN-001\", \"amount\": 15000, \"type\": \"wire\", \"destination\": \"international\", \"merchant\": \"Unknown Corp\"}",
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
                    "name": "Screen Transaction",
                    "type": "Code",
                    "parameters": {
                        "code": """# Transaction screening with risk calculation
txn = node_data["Webhook"]["json"].get("body", {})
amount = txn.get("amount", 0)
txn_type = txn.get("type", "").lower()
destination = txn.get("destination", "").lower()
merchant = txn.get("merchant", "Unknown")

flags = []
risk_score = 0

if amount >= 10000:
    flags.append({"flag": "LARGE_AMOUNT", "points": 30, "desc": "Amount exceeds $10,000 threshold"})
    risk_score += 30
if txn_type == "wire":
    flags.append({"flag": "WIRE_TRANSFER", "points": 20, "desc": "Wire transfer requires additional review"})
    risk_score += 20
if destination == "international":
    flags.append({"flag": "INTERNATIONAL", "points": 25, "desc": "Cross-border transaction"})
    risk_score += 25
if amount >= 10000 and destination == "international":
    flags.append({"flag": "HIGH_VALUE_INTL", "points": 25, "desc": "High-value international transfer"})
    risk_score += 25

if risk_score >= 75:
    decision = "BLOCKED"
    decision_color = "#dc2626"
    decision_bg = "#fef2f2"
elif risk_score >= 50:
    decision = "REVIEW"
    decision_color = "#d97706"
    decision_bg = "#fffbeb"
else:
    decision = "APPROVED"
    decision_color = "#059669"
    decision_bg = "#ecfdf5"

return {
    "transaction_id": txn.get("transaction_id", "TXN-000"),
    "amount": amount,
    "type": txn_type.upper() or "ACH",
    "destination": destination.upper() or "DOMESTIC",
    "merchant": merchant,
    "risk_score": risk_score,
    "flags": flags,
    "decision": decision,
    "decision_color": decision_color,
    "decision_bg": decision_bg
}"""
                    },
                    "position": {"x": 350, "y": 200},
                },
                {
                    "name": "Build Dashboard",
                    "type": "Code",
                    "parameters": {
                        "code": """# Build visual HTML dashboard using string concatenation (no f-strings for CSS)
data = node_data["Screen Transaction"]["json"]

# Build flags HTML
flags_html = ""
for f in data.get("flags", []):
    flags_html += '<div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: #fef3c7; border-radius: 6px; margin-bottom: 6px;">'
    flags_html += '<span style="font-weight: 500; color: #92400e;">' + f["flag"] + '</span>'
    flags_html += '<span style="color: #78716c; font-size: 12px;">+' + str(f["points"]) + ' pts</span>'
    flags_html += '</div>'

if not flags_html:
    flags_html = '<div style="color: #059669; padding: 12px;">No risk flags detected</div>'

# Risk meter color
if data["risk_score"] >= 75:
    meter_color = "#dc2626"
elif data["risk_score"] >= 50:
    meter_color = "#d97706"
else:
    meter_color = "#059669"

# Build HTML using concatenation to avoid expression engine issues
html = '''<!DOCTYPE html>
<html>
<head><style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#f8fafc;padding:24px}
</style></head>
<body>
<div style="background:white;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.1);overflow:hidden;max-width:480px;">
<div style="padding:20px 24px;border-bottom:1px solid #e5e7eb;">
<div style="font-size:14px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Transaction Screening</div>
<div style="font-size:24px;font-weight:600;color:#111827;margin-top:4px;">''' + data["transaction_id"] + '''</div>
<div style="display:inline-block;padding:6px 16px;border-radius:20px;font-weight:600;font-size:14px;margin-top:12px;background:''' + data["decision_bg"] + ''';color:''' + data["decision_color"] + ''';">''' + data["decision"] + '''</div>
</div>
<div style="padding:24px;">
<div style="display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #f3f4f6;">
<span style="color:#6b7280;">Amount</span>
<span style="font-weight:500;color:#111827;font-size:18px;">$''' + "{:,.2f}".format(data["amount"]) + '''</span>
</div>
<div style="display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #f3f4f6;">
<span style="color:#6b7280;">Type</span>
<span style="font-weight:500;color:#111827;">''' + data["type"] + '''</span>
</div>
<div style="display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #f3f4f6;">
<span style="color:#6b7280;">Destination</span>
<span style="font-weight:500;color:#111827;">''' + data["destination"] + '''</span>
</div>
<div style="display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #f3f4f6;">
<span style="color:#6b7280;">Merchant</span>
<span style="font-weight:500;color:#111827;">''' + data["merchant"] + '''</span>
</div>
<div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;margin:20px 0 12px 0;">Risk Assessment</div>
<div style="display:flex;align-items:baseline;gap:8px;">
<span style="font-size:32px;font-weight:700;color:''' + meter_color + ''';">''' + str(data["risk_score"]) + '''</span>
<span style="color:#6b7280;">/ 100</span>
</div>
<div style="height:8px;background:#e5e7eb;border-radius:4px;overflow:hidden;margin-top:8px;">
<div style="height:100%;border-radius:4px;width:''' + str(data["risk_score"]) + '''%;background:''' + meter_color + ''';"></div>
</div>
<div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;margin:20px 0 12px 0;">Risk Flags</div>
''' + flags_html + '''
</div>
</div>
</body>
</html>'''

return {"html": html}"""
                    },
                    "position": {"x": 600, "y": 200},
                },
                {
                    "name": "Display",
                    "type": "HTMLDisplay",
                    "parameters": {"htmlField": "html"},
                    "position": {"x": 850, "y": 200},
                },
                {
                    "name": "Respond",
                    "type": "RespondToWebhook",
                    "parameters": {
                        "statusCode": "200",
                        "responseMode": "lastNode",
                        "responseField": "html",
                        "contentType": "text/html",
                        "wrapResponse": False,
                    },
                    "position": {"x": 1100, "y": 200},
                },
            ],
            "connections": [
                {"source_node": "Webhook", "target_node": "Screen Transaction"},
                {"source_node": "Screen Transaction", "target_node": "Build Dashboard"},
                {"source_node": "Build Dashboard", "target_node": "Display"},
                {"source_node": "Display", "target_node": "Respond"},
            ],
            "settings": {},
        },
    },
    # ========================================
    # 7. RISK REPORT - Executive-style HTML report
    # ========================================
    {
        "name": "Risk Report",
        "description": "Generates an executive risk report. POST with {\"account_id\": \"ACC-12345\", \"period\": \"January 2026\"}",
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
                    "name": "Generate Report",
                    "type": "Code",
                    "parameters": {
                        "code": """# Generate executive risk report
req = node_data["Webhook"]["json"].get("body", {})
account_id = req.get("account_id", "ACC-00000")
period = req.get("period", "January 2026")

# Mock data - in production this would come from databases
report_data = {
    "period": period,
    "account_id": account_id,
    "summary": {
        "total_transactions": 1247,
        "total_volume": 2847500,
        "flagged_transactions": 23,
        "blocked_transactions": 3,
        "approval_rate": 97.6
    },
    "risk_breakdown": [
        {"category": "Large Amount (>$10K)", "count": 45, "percentage": 3.6},
        {"category": "International Wire", "count": 12, "percentage": 1.0},
        {"category": "New Payee", "count": 89, "percentage": 7.1},
        {"category": "After Hours", "count": 34, "percentage": 2.7},
    ],
    "top_alerts": [
        {"id": "ALT-001", "severity": "HIGH", "type": "Unusual Pattern", "status": "Resolved"},
        {"id": "ALT-002", "severity": "MEDIUM", "type": "Large Transfer", "status": "Pending"},
        {"id": "ALT-003", "severity": "LOW", "type": "New Payee", "status": "Resolved"},
    ]
}

# Build risk breakdown rows
risk_rows = ""
for r in report_data["risk_breakdown"]:
    risk_rows += '<tr><td style="padding:12px;border-bottom:1px solid #e5e7eb;">' + r["category"] + '</td>'
    risk_rows += '<td style="padding:12px;border-bottom:1px solid #e5e7eb;text-align:right;">' + str(r["count"]) + '</td>'
    risk_rows += '<td style="padding:12px;border-bottom:1px solid #e5e7eb;text-align:right;">' + str(r["percentage"]) + '%</td></tr>'

# Build alert rows
alert_rows = ""
for a in report_data["top_alerts"]:
    sev_color = "#dc2626" if a["severity"] == "HIGH" else "#d97706" if a["severity"] == "MEDIUM" else "#059669"
    status_color = "#059669" if a["status"] == "Resolved" else "#d97706"
    alert_rows += '<tr><td style="padding:12px;border-bottom:1px solid #e5e7eb;">' + a["id"] + '</td>'
    alert_rows += '<td style="padding:12px;border-bottom:1px solid #e5e7eb;"><span style="color:' + sev_color + ';font-weight:600;">' + a["severity"] + '</span></td>'
    alert_rows += '<td style="padding:12px;border-bottom:1px solid #e5e7eb;">' + a["type"] + '</td>'
    alert_rows += '<td style="padding:12px;border-bottom:1px solid #e5e7eb;"><span style="color:' + status_color + ';">' + a["status"] + '</span></td></tr>'

s = report_data["summary"]

html = '''<!DOCTYPE html>
<html>
<head>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#f1f5f9;padding:32px}
</style>
</head>
<body>
<div style="max-width:800px;margin:0 auto;">

<!-- Header -->
<div style="background:linear-gradient(135deg,#1e40af,#3b82f6);color:white;padding:32px;border-radius:12px 12px 0 0;">
<div style="font-size:12px;opacity:0.8;text-transform:uppercase;letter-spacing:1px;">Risk Management Report</div>
<div style="font-size:28px;font-weight:700;margin-top:8px;">''' + period + '''</div>
<div style="font-size:14px;opacity:0.9;margin-top:4px;">Account: ''' + account_id + '''</div>
</div>

<!-- Summary Cards -->
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-top:-20px;padding:0 20px;">
<div style="background:white;padding:20px;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,0.1);text-align:center;">
<div style="font-size:28px;font-weight:700;color:#1e40af;">''' + "{:,}".format(s["total_transactions"]) + '''</div>
<div style="font-size:12px;color:#6b7280;margin-top:4px;">Total Transactions</div>
</div>
<div style="background:white;padding:20px;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,0.1);text-align:center;">
<div style="font-size:28px;font-weight:700;color:#059669;">$''' + "{:,.0f}".format(s["total_volume"]/1000) + '''K</div>
<div style="font-size:12px;color:#6b7280;margin-top:4px;">Total Volume</div>
</div>
<div style="background:white;padding:20px;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,0.1);text-align:center;">
<div style="font-size:28px;font-weight:700;color:#d97706;">''' + str(s["flagged_transactions"]) + '''</div>
<div style="font-size:12px;color:#6b7280;margin-top:4px;">Flagged</div>
</div>
<div style="background:white;padding:20px;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,0.1);text-align:center;">
<div style="font-size:28px;font-weight:700;color:#dc2626;">''' + str(s["blocked_transactions"]) + '''</div>
<div style="font-size:12px;color:#6b7280;margin-top:4px;">Blocked</div>
</div>
</div>

<!-- Risk Breakdown -->
<div style="background:white;margin-top:24px;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,0.1);overflow:hidden;">
<div style="padding:20px;border-bottom:1px solid #e5e7eb;">
<div style="font-size:16px;font-weight:600;color:#111827;">Risk Category Breakdown</div>
</div>
<table style="width:100%;border-collapse:collapse;">
<thead>
<tr style="background:#f9fafb;">
<th style="padding:12px;text-align:left;font-weight:500;color:#6b7280;">Category</th>
<th style="padding:12px;text-align:right;font-weight:500;color:#6b7280;">Count</th>
<th style="padding:12px;text-align:right;font-weight:500;color:#6b7280;">% of Total</th>
</tr>
</thead>
<tbody>
''' + risk_rows + '''
</tbody>
</table>
</div>

<!-- Recent Alerts -->
<div style="background:white;margin-top:24px;border-radius:8px;box-shadow:0 2px 4px rgba(0,0,0,0.1);overflow:hidden;">
<div style="padding:20px;border-bottom:1px solid #e5e7eb;">
<div style="font-size:16px;font-weight:600;color:#111827;">Recent Alerts</div>
</div>
<table style="width:100%;border-collapse:collapse;">
<thead>
<tr style="background:#f9fafb;">
<th style="padding:12px;text-align:left;font-weight:500;color:#6b7280;">Alert ID</th>
<th style="padding:12px;text-align:left;font-weight:500;color:#6b7280;">Severity</th>
<th style="padding:12px;text-align:left;font-weight:500;color:#6b7280;">Type</th>
<th style="padding:12px;text-align:left;font-weight:500;color:#6b7280;">Status</th>
</tr>
</thead>
<tbody>
''' + alert_rows + '''
</tbody>
</table>
</div>

<!-- Footer -->
<div style="text-align:center;margin-top:24px;padding:16px;color:#6b7280;font-size:12px;">
Generated by Workflow Engine | ''' + period + '''
</div>

</div>
</body>
</html>'''

return {"html": html}"""
                    },
                    "position": {"x": 350, "y": 200},
                },
                {
                    "name": "Respond",
                    "type": "RespondToWebhook",
                    "parameters": {
                        "statusCode": "200",
                        "responseMode": "lastNode",
                        "responseField": "html",
                        "contentType": "text/html",
                        "wrapResponse": False,
                    },
                    "position": {"x": 600, "y": 200},
                },
            ],
            "connections": [
                {"source_node": "Webhook", "target_node": "Generate Report"},
                {"source_node": "Generate Report", "target_node": "Respond"},
            ],
            "settings": {},
        },
    },
    # ========================================
    # 8. BANK STATEMENT - Customer statement retrieval
    # ========================================
    {
        "name": "Customer Bank Statement",
        "description": "Retrieves bank statements for a customer account. Demonstrates the Bank Statement node with date range filtering. Run manually to see sample statement data.",
        "active": False,
        "definition": {
            "nodes": [
                {
                    "name": "Start",
                    "type": "Start",
                    "parameters": {},
                    "position": {"x": 100, "y": 200},
                },
                {
                    "name": "Get Statement",
                    "type": "BankStatement",
                    "parameters": {
                        "accountNumber": "1234567890",
                        "accountHolder": "Rajesh Kumar",
                        "statementType": "full",
                        "dateRange": "last_month",
                        "includeRunningBalance": True,
                    },
                    "position": {"x": 350, "y": 200},
                },
                {
                    "name": "Format Statement",
                    "type": "Code",
                    "parameters": {
                        "code": """# Format the statement data for display
data = node_data["Get Statement"]["json"]

# Build summary
summary = f\"\"\"
=====================================
       BANK STATEMENT
=====================================
Account: {data['account_number']}
Holder:  {data['account_holder']}
Period:  {data['statement_period']['from']} to {data['statement_period']['to']}
-------------------------------------
Opening Balance:  Rs. {data['opening_balance']:>12,.2f}
Total Credits:    Rs. {data['total_credits']:>12,.2f}
Total Debits:     Rs. {data['total_debits']:>12,.2f}
Closing Balance:  Rs. {data['closing_balance']:>12,.2f}
-------------------------------------
Transactions: {data['transaction_count']}
=====================================
\"\"\"

return {
    "summary": summary,
    "statement": data,
    "transaction_count": data['transaction_count']
}"""
                    },
                    "position": {"x": 600, "y": 200},
                },
            ],
            "connections": [
                {"source_node": "Start", "target_node": "Get Statement"},
                {"source_node": "Get Statement", "target_node": "Format Statement"},
            ],
            "settings": {},
        },
    },
    {
        "name": "Bank Statement API",
        "description": "Webhook API to retrieve customer bank statements. POST with {\"account_number\": \"1234567890\", \"account_holder\": \"John Doe\", \"date_range\": \"last_month\"}",
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
                    "name": "Get Statement",
                    "type": "BankStatement",
                    "parameters": {
                        "accountNumber": "{{ $json.body.account_number }}",
                        "accountHolder": "{{ $json.body.account_holder }}",
                        "statementType": "{{ $json.body.statement_type || 'full' }}",
                        "dateRange": "{{ $json.body.date_range || 'last_month' }}",
                        "includeRunningBalance": True,
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
                    },
                    "position": {"x": 600, "y": 200},
                },
            ],
            "connections": [
                {"source_node": "Webhook", "target_node": "Get Statement"},
                {"source_node": "Get Statement", "target_node": "Respond"},
            ],
            "settings": {},
        },
    },
    {
        "name": "Bank Statement Dashboard",
        "description": "Visual bank statement with HTML dashboard. POST with {\"account_number\": \"1234567890\", \"account_holder\": \"Priya Sharma\"}",
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
                    "name": "Get Statement",
                    "type": "BankStatement",
                    "parameters": {
                        "accountNumber": "{{ $json.body.account_number }}",
                        "accountHolder": "{{ $json.body.account_holder }}",
                        "statementType": "full",
                        "dateRange": "last_month",
                        "includeRunningBalance": True,
                    },
                    "position": {"x": 350, "y": 200},
                },
                {
                    "name": "Build Dashboard",
                    "type": "Code",
                    "parameters": {
                        "code": """# Build visual bank statement dashboard
data = node_data["Get Statement"]["json"]

# Build transactions table rows
txn_rows = ""
for t in data.get("transactions", [])[:20]:  # Show max 20 transactions
    amount_color = "#059669" if t["type"] == "CR" else "#dc2626"
    amount_prefix = "+" if t["type"] == "CR" else "-"
    balance_str = "Rs. {:,.2f}".format(t.get("balance", 0)) if "balance" in t else "-"
    txn_rows += '<tr>'
    txn_rows += '<td style="padding:12px;border-bottom:1px solid #e5e7eb;">' + t["date"] + '</td>'
    txn_rows += '<td style="padding:12px;border-bottom:1px solid #e5e7eb;">' + t.get("time", "") + '</td>'
    txn_rows += '<td style="padding:12px;border-bottom:1px solid #e5e7eb;">' + t["description"] + '</td>'
    txn_rows += '<td style="padding:12px;border-bottom:1px solid #e5e7eb;text-align:right;color:' + amount_color + ';font-weight:600;">' + amount_prefix + 'Rs. {:,.2f}'.format(t["amount"]) + '</td>'
    txn_rows += '<td style="padding:12px;border-bottom:1px solid #e5e7eb;text-align:right;">' + balance_str + '</td>'
    txn_rows += '</tr>'

# Calculate net change
net_change = data["total_credits"] - data["total_debits"]
net_color = "#059669" if net_change >= 0 else "#dc2626"
net_prefix = "+" if net_change >= 0 else ""

html = '''<!DOCTYPE html>
<html>
<head>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#f1f5f9;padding:32px}
</style>
</head>
<body>
<div style="max-width:900px;margin:0 auto;">

<!-- Header -->
<div style="background:linear-gradient(135deg,#065f46,#059669);color:white;padding:32px;border-radius:12px 12px 0 0;">
<div style="display:flex;justify-content:space-between;align-items:flex-start;">
<div>
<div style="font-size:12px;opacity:0.8;text-transform:uppercase;letter-spacing:1px;">Bank Statement</div>
<div style="font-size:28px;font-weight:700;margin-top:8px;">''' + data["account_holder"] + '''</div>
<div style="font-size:14px;opacity:0.9;margin-top:4px;">Account: ''' + data["account_number"] + '''</div>
</div>
<div style="text-align:right;">
<div style="font-size:12px;opacity:0.8;">Statement Period</div>
<div style="font-size:16px;font-weight:500;margin-top:4px;">''' + data["statement_period"]["from"] + ''' to ''' + data["statement_period"]["to"] + '''</div>
</div>
</div>
</div>

<!-- Balance Summary -->
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:#e5e7eb;">
<div style="background:white;padding:24px;text-align:center;">
<div style="font-size:12px;color:#6b7280;text-transform:uppercase;">Opening Balance</div>
<div style="font-size:24px;font-weight:700;color:#111827;margin-top:8px;">Rs. ''' + "{:,.2f}".format(data["opening_balance"]) + '''</div>
</div>
<div style="background:white;padding:24px;text-align:center;">
<div style="font-size:12px;color:#6b7280;text-transform:uppercase;">Total Credits</div>
<div style="font-size:24px;font-weight:700;color:#059669;margin-top:8px;">+Rs. ''' + "{:,.2f}".format(data["total_credits"]) + '''</div>
</div>
<div style="background:white;padding:24px;text-align:center;">
<div style="font-size:12px;color:#6b7280;text-transform:uppercase;">Total Debits</div>
<div style="font-size:24px;font-weight:700;color:#dc2626;margin-top:8px;">-Rs. ''' + "{:,.2f}".format(data["total_debits"]) + '''</div>
</div>
<div style="background:white;padding:24px;text-align:center;">
<div style="font-size:12px;color:#6b7280;text-transform:uppercase;">Closing Balance</div>
<div style="font-size:24px;font-weight:700;color:#111827;margin-top:8px;">Rs. ''' + "{:,.2f}".format(data["closing_balance"]) + '''</div>
</div>
</div>

<!-- Net Change Banner -->
<div style="background:white;padding:16px 24px;border-bottom:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center;">
<span style="color:#6b7280;">Net Change This Period</span>
<span style="font-size:20px;font-weight:700;color:''' + net_color + ''';">''' + net_prefix + '''Rs. ''' + "{:,.2f}".format(abs(net_change)) + '''</span>
</div>

<!-- Transactions Table -->
<div style="background:white;border-radius:0 0 12px 12px;overflow:hidden;">
<div style="padding:20px 24px;border-bottom:1px solid #e5e7eb;">
<div style="font-size:16px;font-weight:600;color:#111827;">Transaction History</div>
<div style="font-size:12px;color:#6b7280;margin-top:4px;">''' + str(data["transaction_count"]) + ''' transactions</div>
</div>
<div style="overflow-x:auto;">
<table style="width:100%;border-collapse:collapse;min-width:600px;">
<thead>
<tr style="background:#f9fafb;">
<th style="padding:12px;text-align:left;font-weight:500;color:#6b7280;font-size:12px;text-transform:uppercase;">Date</th>
<th style="padding:12px;text-align:left;font-weight:500;color:#6b7280;font-size:12px;text-transform:uppercase;">Time</th>
<th style="padding:12px;text-align:left;font-weight:500;color:#6b7280;font-size:12px;text-transform:uppercase;">Description</th>
<th style="padding:12px;text-align:right;font-weight:500;color:#6b7280;font-size:12px;text-transform:uppercase;">Amount</th>
<th style="padding:12px;text-align:right;font-weight:500;color:#6b7280;font-size:12px;text-transform:uppercase;">Balance</th>
</tr>
</thead>
<tbody>
''' + txn_rows + '''
</tbody>
</table>
</div>
</div>

<!-- Footer -->
<div style="text-align:center;margin-top:24px;padding:16px;color:#6b7280;font-size:12px;">
Generated by Workflow Engine | This is a demo statement with mock data
</div>

</div>
</body>
</html>'''

return {"html": html}"""
                    },
                    "position": {"x": 600, "y": 200},
                },
                {
                    "name": "Display",
                    "type": "HTMLDisplay",
                    "parameters": {"htmlField": "html"},
                    "position": {"x": 850, "y": 200},
                },
                {
                    "name": "Respond",
                    "type": "RespondToWebhook",
                    "parameters": {
                        "statusCode": "200",
                        "responseMode": "lastNode",
                        "responseField": "html",
                        "contentType": "text/html",
                        "wrapResponse": False,
                    },
                    "position": {"x": 1100, "y": 200},
                },
            ],
            "connections": [
                {"source_node": "Webhook", "target_node": "Get Statement"},
                {"source_node": "Get Statement", "target_node": "Build Dashboard"},
                {"source_node": "Build Dashboard", "target_node": "Display"},
                {"source_node": "Display", "target_node": "Respond"},
            ],
            "settings": {},
        },
    },
    # ========================================
    # 9. OUTPUT NODE DEMOS - HTML and Markdown display
    # ========================================
    {
        "name": "HTML Output Demo",
        "description": "Demonstrates the HTML Display node rendering inline in the output panel. Run manually to see a styled card.",
        "active": False,
        "definition": {
            "nodes": [
                {
                    "name": "Start",
                    "type": "Start",
                    "parameters": {},
                    "position": {"x": 100, "y": 200},
                },
                {
                    "name": "Generate HTML",
                    "type": "Code",
                    "parameters": {
                        "code": """# Generate a sample HTML card
html = '''<!DOCTYPE html>
<html>
<head>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
.card { background: white; border-radius: 16px; padding: 32px; max-width: 400px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); }
.badge { display: inline-block; background: #10b981; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-bottom: 16px; }
h1 { font-size: 24px; color: #1f2937; margin-bottom: 8px; }
p { color: #6b7280; line-height: 1.6; margin-bottom: 16px; }
.stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
.stat { text-align: center; }
.stat-value { font-size: 24px; font-weight: 700; color: #3b82f6; }
.stat-label { font-size: 12px; color: #9ca3af; margin-top: 4px; }
</style>
</head>
<body>
<div class="card">
<span class="badge">Live Demo</span>
<h1>HTML Output Node</h1>
<p>This card is rendered directly in the output panel using the HTMLDisplay node. No modal needed!</p>
<div class="stats">
<div class="stat">
<div class="stat-value">42</div>
<div class="stat-label">Workflows</div>
</div>
<div class="stat">
<div class="stat-value">128</div>
<div class="stat-label">Executions</div>
</div>
<div class="stat">
<div class="stat-value">99%</div>
<div class="stat-label">Success</div>
</div>
</div>
</div>
</body>
</html>'''

return {"html": html}"""
                    },
                    "position": {"x": 350, "y": 200},
                },
                {
                    "name": "Display HTML",
                    "type": "HTMLDisplay",
                    "parameters": {"htmlField": "html"},
                    "position": {"x": 600, "y": 200},
                },
            ],
            "connections": [
                {"source_node": "Start", "target_node": "Generate HTML"},
                {"source_node": "Generate HTML", "target_node": "Display HTML"},
            ],
            "settings": {},
        },
    },
    {
        "name": "Markdown Output Demo",
        "description": "Demonstrates the Markdown Display node rendering formatted text inline. Run manually to see styled markdown.",
        "active": False,
        "definition": {
            "nodes": [
                {
                    "name": "Start",
                    "type": "Start",
                    "parameters": {},
                    "position": {"x": 100, "y": 200},
                },
                {
                    "name": "Generate Markdown",
                    "type": "Code",
                    "parameters": {
                        "code": """# Generate sample markdown content
markdown = '''# Workflow Execution Report

## Summary
The workflow completed successfully with **3 nodes** executed.

## Results

| Metric | Value |
|--------|-------|
| Total Items | 42 |
| Processed | 40 |
| Errors | 2 |
| Duration | 1.23s |

## Details

### Node 1: Data Fetch
- Status: *Completed*
- Items retrieved: 42

### Node 2: Transform
- Applied filters
- Removed duplicates
- **40 items** remaining

### Node 3: Output
- Saved to database
- Sent notifications

---

> This report was generated automatically by the workflow engine.

For more information, see the [documentation](#).
'''

return {"markdown": markdown}"""
                    },
                    "position": {"x": 350, "y": 200},
                },
                {
                    "name": "Display Markdown",
                    "type": "MarkdownDisplay",
                    "parameters": {"markdownField": "markdown"},
                    "position": {"x": 600, "y": 200},
                },
            ],
            "connections": [
                {"source_node": "Start", "target_node": "Generate Markdown"},
                {"source_node": "Generate Markdown", "target_node": "Display Markdown"},
            ],
            "settings": {},
        },
    },
    {
        "name": "AI Summary with Markdown",
        "description": "Uses LLM to generate a markdown-formatted summary. Great for demo! Run manually.",
        "active": False,
        "definition": {
            "nodes": [
                {
                    "name": "Start",
                    "type": "Start",
                    "parameters": {},
                    "position": {"x": 100, "y": 200},
                },
                {
                    "name": "Sample Data",
                    "type": "Set",
                    "parameters": {
                        "mode": "manual",
                        "fields": [
                            {"name": "company", "value": "Acme Bank"},
                            {"name": "quarter", "value": "Q4 2025"},
                            {"name": "revenue", "value": "2.4M"},
                            {"name": "customers", "value": "15,000"},
                            {"name": "growth", "value": "23%"},
                        ],
                    },
                    "position": {"x": 350, "y": 200},
                },
                {
                    "name": "Generate Summary",
                    "type": "LLMChat",
                    "parameters": {
                        "model": "mock",
                        "systemPrompt": "You are a business analyst. Generate a brief markdown-formatted quarterly summary report. Use headers, bullet points, and bold text for emphasis. Keep it concise.",
                        "userMessage": "Generate a Q4 summary for {{ $json.company }} with revenue {{ $json.revenue }}, {{ $json.customers }} customers, and {{ $json.growth }} growth.",
                        "temperature": 0.7,
                        "maxTokens": 500,
                    },
                    "position": {"x": 600, "y": 200},
                },
                {
                    "name": "Format Output",
                    "type": "Code",
                    "parameters": {
                        "code": """# Get LLM response and format as markdown
response = node_data["Generate Summary"]["json"].get("response", "")

# If mock response is generic, create a nice one
if not response or len(response) < 50:
    data = node_data["Sample Data"]["json"]
    response = f'''# {data.get("company", "Company")} - {data.get("quarter", "Q4")} Report

## Key Highlights

- **Revenue**: {data.get("revenue", "N/A")}
- **Customer Base**: {data.get("customers", "N/A")}
- **YoY Growth**: {data.get("growth", "N/A")}

## Performance Summary

The quarter showed **strong performance** across all metrics:

1. Customer acquisition exceeded targets
2. Revenue growth remained consistent
3. Operational efficiency improved

## Outlook

> The company is well-positioned for continued growth in the coming year.

---
*Report generated automatically*
'''

return {"markdown": response}"""
                    },
                    "position": {"x": 850, "y": 200},
                },
                {
                    "name": "Display",
                    "type": "MarkdownDisplay",
                    "parameters": {"markdownField": "markdown"},
                    "position": {"x": 1100, "y": 200},
                },
            ],
            "connections": [
                {"source_node": "Start", "target_node": "Sample Data"},
                {"source_node": "Sample Data", "target_node": "Generate Summary"},
                {"source_node": "Generate Summary", "target_node": "Format Output"},
                {"source_node": "Format Output", "target_node": "Display"},
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
