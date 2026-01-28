"""Seed database with demo workflows for management presentation."""

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
    # HTML TEST - Debug HTML injection
    # ========================================
    {
        "name": "HTML Test",
        "description": "Simple test workflow to debug HTML response. GET or POST to test.",
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
                    "name": "Set HTML",
                    "type": "Set",
                    "parameters": {
                        "mode": "manual",
                        "fields": [
                            {"name": "html", "value": "<!DOCTYPE html><html><body style=\"font-family:sans-serif;padding:40px;background:#f0f0f0;\"><div style=\"max-width:600px;margin:0 auto;background:white;padding:32px;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,0.1);\"><h1 style=\"color:#2563eb;\">HTML Test Success</h1><p>If you see this styled content, HTML injection is working.</p><div style=\"background:#ecfdf5;padding:16px;border-radius:8px;margin-top:16px;\"><strong style=\"color:#059669;\">Status:</strong> Working</div></div></body></html>"}
                        ]
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
                        "wrapResponse": False
                    },
                    "position": {"x": 600, "y": 200},
                },
            ],
            "connections": [
                {"source_node": "Webhook", "target_node": "Set HTML"},
                {"source_node": "Set HTML", "target_node": "Respond"},
            ],
            "settings": {},
        },
    },
    # ========================================
    # HTML TEST 2 - Using Code node
    # ========================================
    {
        "name": "HTML Test (Code)",
        "description": "Test HTML response using Code node instead of Set.",
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
                    "name": "Build HTML",
                    "type": "Code",
                    "parameters": {
                        "code": '''html = """<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;padding:40px;background:#1e3a5f;">
<div style="max-width:600px;margin:0 auto;background:white;padding:32px;border-radius:12px;">
<h1 style="color:#2563eb;margin:0;">Code Node HTML Test</h1>
<p style="color:#6b7280;margin-top:8px;">Generated via Code node</p>
<div style="background:#fef2f2;padding:16px;border-radius:8px;margin-top:16px;border-left:4px solid #dc2626;">
<strong style="color:#dc2626;">Test:</strong> If you see this, Code node HTML works
</div>
</div>
</body>
</html>"""
return {"html": html}'''
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
                        "wrapResponse": False
                    },
                    "position": {"x": 600, "y": 200},
                },
            ],
            "connections": [
                {"source_node": "Webhook", "target_node": "Build HTML"},
                {"source_node": "Build HTML", "target_node": "Respond"},
            ],
            "settings": {},
        },
    },
    # ========================================
    # SAMPLE TEST - Test sampling node with file
    # ========================================
    {
        "name": "Sample Test",
        "description": "Tests the Sample node with a file. POST with {\"file_path\": \"/path/to/data.csv\", \"method\": \"random\", \"size\": 10}",
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
                    "name": "Extract Params",
                    "type": "Set",
                    "parameters": {
                        "mode": "manual",
                        "fields": [
                            {"name": "file_path", "value": "{{ $json.body.file_path }}"},
                            {"name": "method", "value": "{{ $json.body.method }}"},
                            {"name": "size", "value": "{{ $json.body.size }}"}
                        ]
                    },
                    "position": {"x": 300, "y": 200},
                },
                {
                    "name": "Sample Data",
                    "type": "Sample",
                    "parameters": {
                        "sourceType": "file",
                        "fileLocation": "local",
                        "filePath": "{{ $json.file_path }}",
                        "method": "random",
                        "sampleSize": 10,
                        "seed": 42
                    },
                    "position": {"x": 500, "y": 200},
                },
                {
                    "name": "Format Result",
                    "type": "Code",
                    "parameters": {
                        "code": '''# Format the sampling result as HTML table
result = json_data

original = result.get("original_count", 0)
sampled = result.get("sampled_count", 0)
method = result.get("method", "unknown")
data = result.get("data", [])

# Get column headers from first row
headers = list(data[0].keys()) if data else []

# Build header row
header_html = "".join([f\'<th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;text-transform:uppercase;white-space:nowrap;">{h}</th>\' for h in headers])

# Build data rows
rows = ""
for row in data:
    cells = "".join([f\'<td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">{row.get(h, "")}</td>\' for h in headers])
    rows += f"<tr>{cells}</tr>"

html = f"""<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;padding:40px;background:#f1f5f9;">
<div style="max-width:1000px;margin:0 auto;">

<div style="background:linear-gradient(135deg,#7c3aed 0%,#a855f7 100%);color:white;padding:24px 32px;border-radius:12px 12px 0 0;">
<h1 style="margin:0;font-size:24px;">Sample Node Test</h1>
<p style="margin:8px 0 0;opacity:0.9;">File-based data sampling</p>
</div>

<div style="background:white;padding:24px 32px;display:grid;grid-template-columns:repeat(3,1fr);gap:16px;border-bottom:1px solid #e5e7eb;">
<div style="text-align:center;padding:16px;background:#f8fafc;border-radius:8px;">
<div style="font-size:12px;color:#6b7280;text-transform:uppercase;">Method</div>
<div style="font-size:20px;font-weight:700;color:#7c3aed;margin-top:4px;">{method}</div>
</div>
<div style="text-align:center;padding:16px;background:#f8fafc;border-radius:8px;">
<div style="font-size:12px;color:#6b7280;text-transform:uppercase;">Original</div>
<div style="font-size:20px;font-weight:700;color:#374151;margin-top:4px;">{original} rows</div>
</div>
<div style="text-align:center;padding:16px;background:#ecfdf5;border-radius:8px;">
<div style="font-size:12px;color:#059669;text-transform:uppercase;">Sampled</div>
<div style="font-size:20px;font-weight:700;color:#059669;margin-top:4px;">{sampled} rows</div>
</div>
</div>

<div style="background:white;padding:24px 32px;border-radius:0 0 12px 12px;overflow-x:auto;">
<div style="font-size:16px;font-weight:600;margin-bottom:16px;">Sampled Data ({len(headers)} columns)</div>
<table style="width:100%;border-collapse:collapse;min-width:600px;">
<thead>
<tr style="background:#f8fafc;">{header_html}</tr>
</thead>
<tbody>{rows}</tbody>
</table>
</div>

</div>
</body>
</html>"""

return {"html": html}'''
                    },
                    "position": {"x": 700, "y": 200},
                },
                {
                    "name": "Respond",
                    "type": "RespondToWebhook",
                    "parameters": {
                        "statusCode": "200",
                        "responseMode": "lastNode",
                        "responseField": "html",
                        "contentType": "text/html",
                        "wrapResponse": False
                    },
                    "position": {"x": 900, "y": 200},
                },
            ],
            "connections": [
                {"source_node": "Webhook", "target_node": "Extract Params"},
                {"source_node": "Extract Params", "target_node": "Sample Data"},
                {"source_node": "Sample Data", "target_node": "Format Result"},
                {"source_node": "Format Result", "target_node": "Respond"},
            ],
            "settings": {},
        },
    },
    # ========================================
    # STATEMENT ANALYZER - AI-Generated HTML Report
    # ========================================
    {
        "name": "Statement Analyzer",
        "description": "Fetches bank statement and uses AI to generate beautiful HTML report. Pure no-code workflow. POST with {\"account_number\": \"1234567890\", \"account_holder\": \"John Smith\", \"from_date\": \"2025-01-01\", \"to_date\": \"2025-01-31\"}",
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
                    "name": "Fetch Statement",
                    "type": "HttpRequest",
                    "parameters": {
                        "method": "POST",
                        "url": "http://localhost:8001/bank/statement",
                        "responseType": "json",
                        "body": {
                            "account_number": "{{ $json.body.account_number }}",
                            "account_holder": "{{ $json.body.account_holder }}",
                            "from_date": "{{ $json.body.from_date }}",
                            "to_date": "{{ $json.body.to_date }}",
                            "statement_type": "full",
                            "include_running_balance": True,
                        },
                    },
                    "position": {"x": 350, "y": 200},
                },
                {
                    "name": "Generate Report",
                    "type": "LLMChat",
                    "parameters": {
                        "model": "mock",  # Change to "gemini-2.0-flash" with valid API key
                        "systemPrompt": """You are a financial report generator. Generate a beautiful, modern HTML bank statement report.

Requirements:
- Output ONLY valid HTML, no markdown, no code blocks, no explanation
- Use inline styles (no <style> tags)
- Modern design with gradients, rounded corners, shadows
- Color scheme: blues (#1e3a5f, #2563eb) for headers, green (#059669) for credits, red (#dc2626) for debits
- Include: header with bank name, account info bar, summary cards (opening/closing/credits/debits), transaction table, AI insights section, footer
- Format all currency with $ and commas
- Show transactions in a clean table with date, description, reference, amount, balance
- Add an "AI Insights" section with 2-3 observations about spending patterns
- Make it look like a professional bank statement PDF""",
                        "userMessage": """Generate an HTML bank statement report for this data:

Account Holder: {{ $json.body.account_holder }}
Account Number: {{ $json.body.account_number }}
Statement Period: {{ $json.body.statement_period.from }} to {{ $json.body.statement_period.to }}
Opening Balance: {{ $json.body.opening_balance }}
Closing Balance: {{ $json.body.closing_balance }}
Total Credits: {{ $json.body.total_credits }}
Total Debits: {{ $json.body.total_debits }}
Transaction Count: {{ $json.body.transaction_count }}

Transactions (show first 15):
{{ $json.body.transactions }}""",
                        "temperature": 0.3,
                        "maxTokens": 4000,
                    },
                    "position": {"x": 600, "y": 200},
                },
                {
                    "name": "Respond",
                    "type": "RespondToWebhook",
                    "parameters": {
                        "statusCode": "200",
                        "responseMode": "lastNode",
                        "responseField": "response",
                        "contentType": "text/html",
                        "wrapResponse": False,
                    },
                    "position": {"x": 850, "y": 200},
                },
            ],
            "connections": [
                {"source_node": "Webhook", "target_node": "Fetch Statement"},
                {"source_node": "Fetch Statement", "target_node": "Generate Report"},
                {"source_node": "Generate Report", "target_node": "Respond"},
            ],
            "settings": {},
        },
    },
    # ========================================
    # LOAN DECISION REPORT - Credit Analysis
    # ========================================
    {
        "name": "Loan Decision Report",
        "description": "Analyzes loan application and generates credit decision report. POST with {\"applicant_name\": \"Sarah Johnson\", \"loan_amount\": 250000, \"loan_purpose\": \"Home Purchase\", \"annual_income\": 95000, \"employment_years\": 5, \"credit_score\": 720}",
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
                    "name": "Calculate Risk",
                    "type": "Code",
                    "parameters": {
                        "code": '''# Calculate loan risk metrics
app = node_data["Webhook"]["json"].get("body", {})

name = app.get("applicant_name", "Applicant")
loan_amount = float(app.get("loan_amount", 0))
income = float(app.get("annual_income", 1))
credit_score = int(app.get("credit_score", 600))
employment_years = int(app.get("employment_years", 0))
purpose = app.get("loan_purpose", "Personal")

# Calculate DTI (assuming 30% of income goes to this loan annually)
monthly_payment = (loan_amount * 0.065) / 12  # ~6.5% rate estimate
dti = (monthly_payment * 12) / income * 100

# Risk scoring
risk_score = 0
risk_factors = []
positive_factors = []

# Credit score analysis
if credit_score >= 750:
    risk_score += 30
    positive_factors.append(("Excellent credit score", credit_score, "+30"))
elif credit_score >= 700:
    risk_score += 20
    positive_factors.append(("Good credit score", credit_score, "+20"))
elif credit_score >= 650:
    risk_score += 10
    risk_factors.append(("Fair credit score", credit_score, "+10"))
else:
    risk_factors.append(("Poor credit score", credit_score, "+0"))

# DTI analysis
if dti <= 28:
    risk_score += 30
    positive_factors.append(("Low debt-to-income ratio", str(round(dti, 1)) + "%", "+30"))
elif dti <= 36:
    risk_score += 20
    positive_factors.append(("Acceptable DTI ratio", str(round(dti, 1)) + "%", "+20"))
elif dti <= 43:
    risk_score += 10
    risk_factors.append(("High DTI ratio", str(round(dti, 1)) + "%", "+10"))
else:
    risk_factors.append(("Very high DTI ratio", str(round(dti, 1)) + "%", "+0"))

# Employment analysis
if employment_years >= 5:
    risk_score += 25
    positive_factors.append(("Stable employment history", str(employment_years) + " years", "+25"))
elif employment_years >= 2:
    risk_score += 15
    positive_factors.append(("Adequate employment history", str(employment_years) + " years", "+15"))
else:
    risk_factors.append(("Limited employment history", str(employment_years) + " years", "+5"))
    risk_score += 5

# Loan-to-income ratio
lti = loan_amount / income
if lti <= 3:
    risk_score += 15
    positive_factors.append(("Conservative loan amount", str(round(lti, 1)) + "x income", "+15"))
elif lti <= 4:
    risk_score += 10
elif lti <= 5:
    risk_factors.append(("High loan-to-income", str(round(lti, 1)) + "x income", "+0"))

# Decision
if risk_score >= 80:
    decision = "APPROVED"
    decision_color = "#059669"
    decision_bg = "#ecfdf5"
    rate = "5.99%"
elif risk_score >= 60:
    decision = "APPROVED WITH CONDITIONS"
    decision_color = "#d97706"
    decision_bg = "#fffbeb"
    rate = "7.49%"
elif risk_score >= 40:
    decision = "REFER TO UNDERWRITER"
    decision_color = "#d97706"
    decision_bg = "#fffbeb"
    rate = "8.99%"
else:
    decision = "DECLINED"
    decision_color = "#dc2626"
    decision_bg = "#fef2f2"
    rate = "N/A"

return {
    "applicant": name,
    "loan_amount": loan_amount,
    "purpose": purpose,
    "income": income,
    "credit_score": credit_score,
    "employment_years": employment_years,
    "dti": round(dti, 1),
    "lti": round(lti, 1),
    "risk_score": risk_score,
    "decision": decision,
    "decision_color": decision_color,
    "decision_bg": decision_bg,
    "rate": rate,
    "monthly_payment": round(monthly_payment, 2),
    "risk_factors": risk_factors,
    "positive_factors": positive_factors
}'''
                    },
                    "position": {"x": 350, "y": 200},
                },
                {
                    "name": "AI Assessment",
                    "type": "LLMChat",
                    "parameters": {
                        "model": "mock",
                        "systemPrompt": "You are a loan underwriter. Provide a 2-3 sentence professional assessment of this loan application based on the risk factors. Be specific and actionable.",
                        "userMessage": "Loan: ${{ $json.loan_amount }} for {{ $json.purpose }}. Credit: {{ $json.credit_score }}. DTI: {{ $json.dti }}%. Employment: {{ $json.employment_years }} years. Risk Score: {{ $json.risk_score }}/100. Decision: {{ $json.decision }}",
                        "temperature": 0.3,
                        "maxTokens": 200,
                    },
                    "position": {"x": 600, "y": 200},
                },
                {
                    "name": "Build Report",
                    "type": "Code",
                    "parameters": {
                        "code": '''# Build loan decision report
d = node_data["Calculate Risk"]["json"]
ai = node_data["AI Assessment"]["json"].get("response", "Assessment pending.")

def fmt(n):
    return "{:,.2f}".format(float(n))

def fmt_int(n):
    return "{:,}".format(int(n))

# Build risk factors HTML
factors_html = ""
for f in d.get("positive_factors", []):
    factors_html += f"""<div style="display:flex;justify-content:space-between;padding:12px 16px;background:#ecfdf5;border-radius:8px;margin-bottom:8px;">
    <div><span style="color:#059669;margin-right:8px;">&#10003;</span>{f[0]}</div>
    <div style="display:flex;gap:16px;"><span style="color:#6b7280;">{f[1]}</span><span style="color:#059669;font-weight:600;">{f[2]}</span></div>
    </div>"""

for f in d.get("risk_factors", []):
    factors_html += f"""<div style="display:flex;justify-content:space-between;padding:12px 16px;background:#fef2f2;border-radius:8px;margin-bottom:8px;">
    <div><span style="color:#dc2626;margin-right:8px;">&#9888;</span>{f[0]}</div>
    <div style="display:flex;gap:16px;"><span style="color:#6b7280;">{f[1]}</span><span style="color:#dc2626;font-weight:600;">{f[2]}</span></div>
    </div>"""

# Score gauge position (0-100 mapped to percentage)
gauge_pct = d.get("risk_score", 0)

html = f"""<!DOCTYPE html>
<html>
<head><style>body{{{{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f1f5f9;margin:0;padding:40px 20px}}}}</style></head>
<body>
<div style="max-width:800px;margin:0 auto;">

<!-- Header -->
<div style="background:linear-gradient(135deg,#1e40af 0%,#7c3aed 100%);color:white;padding:32px 40px;border-radius:16px 16px 0 0;">
<div style="display:flex;justify-content:space-between;align-items:center;">
<div>
<div style="font-size:12px;opacity:0.8;text-transform:uppercase;letter-spacing:1px;">Loan Decision Report</div>
<div style="font-size:28px;font-weight:700;margin-top:8px;">{d.get("applicant")}</div>
</div>
<div style="text-align:right;">
<div style="font-size:14px;opacity:0.8;">{d.get("purpose")}</div>
<div style="font-size:32px;font-weight:700;margin-top:4px;">${fmt_int(d.get("loan_amount"))}</div>
</div>
</div>
</div>

<!-- Decision Banner -->
<div style="background:{d.get("decision_bg")};padding:24px 40px;display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid {d.get("decision_color")};">
<div>
<div style="font-size:14px;color:#6b7280;">Decision</div>
<div style="font-size:28px;font-weight:700;color:{d.get("decision_color")};">{d.get("decision")}</div>
</div>
<div style="text-align:right;">
<div style="font-size:14px;color:#6b7280;">Proposed Rate</div>
<div style="font-size:28px;font-weight:700;color:{d.get("decision_color")};">{d.get("rate")}</div>
</div>
</div>

<!-- Risk Score -->
<div style="background:white;padding:32px 40px;border-bottom:1px solid #e5e7eb;">
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
<div style="font-size:18px;font-weight:600;">Risk Assessment Score</div>
<div style="font-size:36px;font-weight:700;color:{d.get("decision_color")};">{d.get("risk_score")}<span style="font-size:18px;color:#6b7280;">/100</span></div>
</div>
<div style="height:12px;background:#e5e7eb;border-radius:6px;overflow:hidden;">
<div style="height:100%;width:{gauge_pct}%;background:linear-gradient(90deg,#dc2626 0%,#d97706 40%,#059669 70%);border-radius:6px;"></div>
</div>
<div style="display:flex;justify-content:space-between;margin-top:8px;font-size:12px;color:#6b7280;">
<span>High Risk</span><span>Low Risk</span>
</div>
</div>

<!-- Key Metrics -->
<div style="background:white;padding:32px 40px;display:grid;grid-template-columns:repeat(4,1fr);gap:20px;border-bottom:1px solid #e5e7eb;">
<div style="text-align:center;padding:16px;background:#f8fafc;border-radius:12px;">
<div style="font-size:12px;color:#6b7280;text-transform:uppercase;">Credit Score</div>
<div style="font-size:24px;font-weight:700;color:#1e40af;margin-top:4px;">{d.get("credit_score")}</div>
</div>
<div style="text-align:center;padding:16px;background:#f8fafc;border-radius:12px;">
<div style="font-size:12px;color:#6b7280;text-transform:uppercase;">DTI Ratio</div>
<div style="font-size:24px;font-weight:700;color:#1e40af;margin-top:4px;">{d.get("dti")}%</div>
</div>
<div style="text-align:center;padding:16px;background:#f8fafc;border-radius:12px;">
<div style="font-size:12px;color:#6b7280;text-transform:uppercase;">Employment</div>
<div style="font-size:24px;font-weight:700;color:#1e40af;margin-top:4px;">{d.get("employment_years")} yrs</div>
</div>
<div style="text-align:center;padding:16px;background:#f8fafc;border-radius:12px;">
<div style="font-size:12px;color:#6b7280;text-transform:uppercase;">Monthly Pmt</div>
<div style="font-size:24px;font-weight:700;color:#1e40af;margin-top:4px;">${fmt_int(d.get("monthly_payment"))}</div>
</div>
</div>

<!-- Risk Factors -->
<div style="background:white;padding:32px 40px;border-bottom:1px solid #e5e7eb;">
<div style="font-size:18px;font-weight:600;margin-bottom:20px;">Risk Analysis</div>
{factors_html}
</div>

<!-- AI Assessment -->
<div style="background:#f0f9ff;padding:24px 40px;border-bottom:1px solid #0ea5e9;">
<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
<div style="width:32px;height:32px;background:#0ea5e9;border-radius:8px;display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:12px;">AI</div>
<div style="font-weight:600;color:#0c4a6e;">Underwriter Assessment</div>
</div>
<div style="color:#164e63;line-height:1.6;">{ai}</div>
</div>

<!-- Footer -->
<div style="background:white;padding:20px 40px;border-radius:0 0 16px 16px;text-align:center;color:#9ca3af;font-size:12px;">
Generated by Workflow Engine | Loan Decision Report
</div>

</div>
</body>
</html>"""

return {"html": html}'''
                    },
                    "position": {"x": 850, "y": 200},
                },
                {
                    "name": "Display",
                    "type": "HTMLDisplay",
                    "parameters": {"htmlField": "html"},
                    "position": {"x": 1100, "y": 200},
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
                    "position": {"x": 1350, "y": 200},
                },
            ],
            "connections": [
                {"source_node": "Webhook", "target_node": "Calculate Risk"},
                {"source_node": "Calculate Risk", "target_node": "AI Assessment"},
                {"source_node": "AI Assessment", "target_node": "Build Report"},
                {"source_node": "Build Report", "target_node": "Display"},
                {"source_node": "Display", "target_node": "Respond"},
            ],
            "settings": {},
        },
    },
    # ========================================
    # EXPENSE APPROVAL ROUTER - Branching Decision Logic
    # ========================================
    {
        "name": "Expense Approval Router",
        "description": "Routes expense requests through approval workflow based on amount thresholds. Uses Switch for multi-path routing. POST with {\"employee\": \"John Doe\", \"department\": \"Engineering\", \"amount\": 500, \"category\": \"Software\", \"description\": \"IDE License\"}",
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
                    "name": "Validate Request",
                    "type": "Code",
                    "parameters": {
                        "code": '''# Extract and validate expense request
req = node_data["Webhook"]["json"].get("body", {})
amount = float(req.get("amount", 0))
employee = req.get("employee", "Unknown")
dept = req.get("department", "General")
category = req.get("category", "Other")
desc = req.get("description", "No description")

# Determine approval tier based on amount
if amount <= 100:
    tier = "auto"
    approver = "System"
    sla = "Instant"
elif amount <= 500:
    tier = "manager"
    approver = "Department Manager"
    sla = "24 hours"
elif amount <= 2000:
    tier = "director"
    approver = "Finance Director"
    sla = "48 hours"
else:
    tier = "executive"
    approver = "CFO"
    sla = "72 hours"

return {
    "employee": employee,
    "department": dept,
    "amount": amount,
    "category": category,
    "description": desc,
    "tier": tier,
    "approver": approver,
    "sla": sla
}'''
                    },
                    "position": {"x": 300, "y": 300},
                },
                {
                    "name": "Route by Amount",
                    "type": "Switch",
                    "parameters": {
                        "mode": "rules",
                        "numberOfOutputs": 4,
                        "rules": [
                            {"field": "tier", "operation": "equals", "value": "auto", "output": 0},
                            {"field": "tier", "operation": "equals", "value": "manager", "output": 1},
                            {"field": "tier", "operation": "equals", "value": "director", "output": 2},
                            {"field": "tier", "operation": "equals", "value": "executive", "output": 3}
                        ]
                    },
                    "position": {"x": 550, "y": 300},
                },
                {
                    "name": "Auto Approve",
                    "type": "Set",
                    "parameters": {
                        "mode": "manual",
                        "fields": [
                            {"name": "status", "value": "APPROVED"},
                            {"name": "status_color", "value": "#059669"},
                            {"name": "status_bg", "value": "#ecfdf5"},
                            {"name": "message", "value": "Automatically approved - within auto-approval threshold"},
                            {"name": "next_steps", "value": "Expense will be reimbursed in next payroll cycle."}
                        ]
                    },
                    "position": {"x": 800, "y": 100},
                },
                {
                    "name": "Manager Review",
                    "type": "Set",
                    "parameters": {
                        "mode": "manual",
                        "fields": [
                            {"name": "status", "value": "PENDING MANAGER"},
                            {"name": "status_color", "value": "#d97706"},
                            {"name": "status_bg", "value": "#fffbeb"},
                            {"name": "message", "value": "Routed to department manager for approval"},
                            {"name": "next_steps", "value": "Manager will review within 24 hours. You'll receive email notification."}
                        ]
                    },
                    "position": {"x": 800, "y": 250},
                },
                {
                    "name": "Director Review",
                    "type": "Set",
                    "parameters": {
                        "mode": "manual",
                        "fields": [
                            {"name": "status", "value": "PENDING DIRECTOR"},
                            {"name": "status_color", "value": "#7c3aed"},
                            {"name": "status_bg", "value": "#f5f3ff"},
                            {"name": "message", "value": "Escalated to Finance Director due to amount"},
                            {"name": "next_steps", "value": "Director review required for expenses over $500. Expected response in 48 hours."}
                        ]
                    },
                    "position": {"x": 800, "y": 400},
                },
                {
                    "name": "Executive Review",
                    "type": "Set",
                    "parameters": {
                        "mode": "manual",
                        "fields": [
                            {"name": "status", "value": "PENDING CFO"},
                            {"name": "status_color", "value": "#dc2626"},
                            {"name": "status_bg", "value": "#fef2f2"},
                            {"name": "message", "value": "Escalated to CFO - high value expense"},
                            {"name": "next_steps", "value": "CFO approval required for expenses over $2,000. Please ensure business justification is documented."}
                        ]
                    },
                    "position": {"x": 800, "y": 550},
                },
                {
                    "name": "Build Response",
                    "type": "Code",
                    "parameters": {
                        "code": '''# Build the approval status response - data comes merged from Set node
# The Set node merges its fields into the input, so all data is in json_data
v = json_data

def fmt(n):
    return "{:,.2f}".format(float(n))

status = v.get("status", "PENDING")
status_color = v.get("status_color", "#6b7280")
status_bg = v.get("status_bg", "#f3f4f6")
message = v.get("message", "Processing...")
next_steps = v.get("next_steps", "")

html = f"""<!DOCTYPE html>
<html>
<head><style>body{{{{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f1f5f9;margin:0;padding:40px 20px}}}}</style></head>
<body>
<div style="max-width:600px;margin:0 auto;">

<!-- Header -->
<div style="background:linear-gradient(135deg,#1e40af 0%,#3b82f6 100%);color:white;padding:32px;border-radius:16px 16px 0 0;text-align:center;">
<div style="font-size:14px;opacity:0.8;text-transform:uppercase;letter-spacing:1px;">Expense Request</div>
<div style="font-size:42px;font-weight:700;margin-top:8px;">${fmt(v.get("amount"))}</div>
<div style="margin-top:8px;opacity:0.9;">{v.get("category")} - {v.get("description")}</div>
</div>

<!-- Status Banner -->
<div style="background:{status_bg};padding:24px 32px;border-bottom:3px solid {status_color};">
<div style="display:flex;justify-content:space-between;align-items:center;">
<div>
<div style="font-size:12px;color:#6b7280;text-transform:uppercase;">Status</div>
<div style="font-size:24px;font-weight:700;color:{status_color};">{status}</div>
</div>
<div style="width:48px;height:48px;background:{status_color};border-radius:50%;display:flex;align-items:center;justify-content:center;">
<span style="color:white;font-size:24px;">{"&#10003;" if "APPROVED" in status else "&#8635;"}</span>
</div>
</div>
<div style="margin-top:12px;color:#374151;">{message}</div>
</div>

<!-- Request Details -->
<div style="background:white;padding:32px;">
<div style="font-size:16px;font-weight:600;margin-bottom:20px;color:#111827;">Request Details</div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
<div style="padding:16px;background:#f8fafc;border-radius:8px;">
<div style="font-size:12px;color:#6b7280;text-transform:uppercase;">Employee</div>
<div style="font-size:16px;font-weight:600;margin-top:4px;">{v.get("employee")}</div>
</div>
<div style="padding:16px;background:#f8fafc;border-radius:8px;">
<div style="font-size:12px;color:#6b7280;text-transform:uppercase;">Department</div>
<div style="font-size:16px;font-weight:600;margin-top:4px;">{v.get("department")}</div>
</div>
<div style="padding:16px;background:#f8fafc;border-radius:8px;">
<div style="font-size:12px;color:#6b7280;text-transform:uppercase;">Approver</div>
<div style="font-size:16px;font-weight:600;margin-top:4px;">{v.get("approver")}</div>
</div>
<div style="padding:16px;background:#f8fafc;border-radius:8px;">
<div style="font-size:12px;color:#6b7280;text-transform:uppercase;">Expected SLA</div>
<div style="font-size:16px;font-weight:600;margin-top:4px;">{v.get("sla")}</div>
</div>
</div>
</div>

<!-- Approval Workflow Visual -->
<div style="background:white;padding:24px 32px;border-top:1px solid #e5e7eb;">
<div style="font-size:14px;font-weight:600;color:#6b7280;margin-bottom:16px;">Approval Thresholds</div>
<div style="display:flex;justify-content:space-between;font-size:12px;">
<div style="text-align:center;flex:1;padding:8px;background:{"#ecfdf5" if v.get("tier") == "auto" else "#f8fafc"};border-radius:8px;margin-right:4px;">
<div style="font-weight:600;color:{"#059669" if v.get("tier") == "auto" else "#9ca3af"};">Auto</div>
<div style="color:#6b7280;">≤$100</div>
</div>
<div style="text-align:center;flex:1;padding:8px;background:{"#fffbeb" if v.get("tier") == "manager" else "#f8fafc"};border-radius:8px;margin-right:4px;">
<div style="font-weight:600;color:{"#d97706" if v.get("tier") == "manager" else "#9ca3af"};">Manager</div>
<div style="color:#6b7280;">≤$500</div>
</div>
<div style="text-align:center;flex:1;padding:8px;background:{"#f5f3ff" if v.get("tier") == "director" else "#f8fafc"};border-radius:8px;margin-right:4px;">
<div style="font-weight:600;color:{"#7c3aed" if v.get("tier") == "director" else "#9ca3af"};">Director</div>
<div style="color:#6b7280;">≤$2000</div>
</div>
<div style="text-align:center;flex:1;padding:8px;background:{"#fef2f2" if v.get("tier") == "executive" else "#f8fafc"};border-radius:8px;">
<div style="font-weight:600;color:{"#dc2626" if v.get("tier") == "executive" else "#9ca3af"};">CFO</div>
<div style="color:#6b7280;">>$2000</div>
</div>
</div>
</div>

<!-- Next Steps -->
<div style="background:#f0f9ff;padding:20px 32px;border-radius:0 0 16px 16px;">
<div style="font-size:14px;font-weight:600;color:#0c4a6e;margin-bottom:8px;">Next Steps</div>
<div style="color:#164e63;font-size:14px;">{next_steps}</div>
</div>

</div>
</body>
</html>"""

return {"html": html}'''
                    },
                    "position": {"x": 1050, "y": 300},
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
                    "position": {"x": 1300, "y": 300},
                },
            ],
            "connections": [
                {"source_node": "Webhook", "target_node": "Validate Request"},
                {"source_node": "Validate Request", "target_node": "Route by Amount"},
                {"source_node": "Route by Amount", "target_node": "Auto Approve", "source_output": "output0"},
                {"source_node": "Route by Amount", "target_node": "Manager Review", "source_output": "output1"},
                {"source_node": "Route by Amount", "target_node": "Director Review", "source_output": "output2"},
                {"source_node": "Route by Amount", "target_node": "Executive Review", "source_output": "output3"},
                {"source_node": "Auto Approve", "target_node": "Build Response"},
                {"source_node": "Manager Review", "target_node": "Build Response"},
                {"source_node": "Director Review", "target_node": "Build Response"},
                {"source_node": "Executive Review", "target_node": "Build Response"},
                {"source_node": "Build Response", "target_node": "Respond"},
            ],
            "settings": {},
        },
    },
    # ========================================
    # PROMPT OPTIMIZER - Iterative Prompt Refinement
    # ========================================
    {
        "name": "Prompt Optimizer",
        "description": "Iteratively generates and refines classification prompts based on evaluation feedback. Demonstrates the full prompt optimization loop. POST with custom business requirements or use defaults.",
        "active": True,
        "definition": {
            "nodes": [
                {
                    "name": "Input",
                    "type": "Webhook",
                    "parameters": {"method": "POST"},
                    "position": {"x": 50, "y": 300},
                },
                {
                    "name": "Setup Requirements",
                    "type": "Code",
                    "parameters": {
                        "code": '''# Setup business requirements - use POST body or defaults
body = node_data.get("Input", {}).get("json", {}).get("body", {})

requirement = body.get("requirement", "Classify customer support tickets into: Billing (payment issues, invoices, refunds), Technical (bugs, errors, how-to questions), Sales (pricing, upgrades, demos), and General (everything else).")

categories = body.get("categories", ["Billing", "Technical", "Sales", "General"])

test_data = body.get("test_data", [
    {"input": "My credit card was charged twice for the same order", "expected": "Billing"},
    {"input": "The app crashes when I try to export to PDF", "expected": "Technical"},
    {"input": "What's the price difference between Pro and Enterprise?", "expected": "Sales"},
    {"input": "How do I reset my password?", "expected": "Technical"},
    {"input": "I want a refund for my subscription", "expected": "Billing"},
    {"input": "Can I get a demo of the new features?", "expected": "Sales"},
    {"input": "Where is your office located?", "expected": "General"},
    {"input": "The API returns 500 error on POST requests", "expected": "Technical"},
    {"input": "I need an invoice for tax purposes", "expected": "Billing"},
    {"input": "Do you offer educational discounts?", "expected": "Sales"}
])

target_accuracy = body.get("target_accuracy", 0.8)
max_iterations = body.get("max_iterations", 3)

return {
    "requirement": requirement,
    "categories": categories,
    "test_data": test_data,
    "target_accuracy": target_accuracy,
    "max_iterations": max_iterations
}'''
                    },
                    "position": {"x": 250, "y": 300},
                },
                {
                    "name": "Generate Initial Prompt",
                    "type": "LLMChat",
                    "parameters": {
                        "model": "gemini-2.0-flash",
                        "systemPrompt": "You are a prompt engineering expert. Create a classification prompt.\n\nReturn ONLY valid JSON with this structure:\n{\"prompt\": \"your classification prompt here, use [INPUT] as placeholder for text to classify\"}",
                        "userMessage": "Create a classification prompt for this task:\n\n{{ $json.requirement }}\n\nCategories: {{ $json.categories }}\n\nThe prompt must:\n1. Define each category clearly with examples\n2. Instruct to output JSON: {\"category\": \"...\", \"confidence\": 0.0-1.0, \"reasoning\": \"...\"}\n3. Use [INPUT] as placeholder for the text to classify",
                        "temperature": 0.3
                    },
                    "position": {"x": 500, "y": 300},
                },
                {
                    "name": "Initialize State",
                    "type": "Code",
                    "parameters": {
                        "code": '''# Parse generated prompt and initialize optimization state
response = json_data.get("response", "")

# Extract JSON from response
prompt = response
try:
    import re
    match = re.search(r'\\{[\\s\\S]*\\}', response)
    if match:
        import json
        parsed = json.loads(match.group())
        prompt = parsed.get("prompt", response)
except:
    pass

# Get original input data
input_node = node_data.get("Setup Requirements", {}).get("json", {})

return {
    "prompt": prompt,
    "version": "1.0",
    "iteration": 0,
    "test_data": input_node.get("test_data", []),
    "categories": input_node.get("categories", []),
    "target_accuracy": input_node.get("target_accuracy", 0.8),
    "max_iterations": input_node.get("max_iterations", 3),
    "history": []
}'''
                    },
                    "position": {"x": 750, "y": 300},
                },
                {
                    "name": "Optimization Loop",
                    "type": "Loop",
                    "parameters": {
                        "maxIterations": 5,
                        "exitCondition": "{{ $json.done === true }}"
                    },
                    "position": {"x": 1000, "y": 300},
                },
                {
                    "name": "Evaluate Prompt",
                    "type": "LLMChat",
                    "parameters": {
                        "model": "gemini-2.0-flash",
                        "systemPrompt": "You are a prompt evaluator. Test the given classification prompt against test examples.\n\nFor EACH test example, apply the classification prompt logic and determine what category it would be classified as.\n\nReturn ONLY valid JSON:\n{\n  \"results\": [\n    {\"input\": \"...\", \"expected\": \"...\", \"predicted\": \"...\", \"correct\": true/false},\n    ...\n  ],\n  \"accuracy\": 0.0-1.0,\n  \"errors\": [{\"input\": \"...\", \"expected\": \"...\", \"predicted\": \"...\"}]\n}",
                        "userMessage": "Evaluate this classification prompt:\n\n{{ $json.prompt }}\n\n---\n\nTest examples to evaluate:\n{{ $json.test_data }}\n\nFor each example, determine what the prompt would classify it as, then compare to expected.",
                        "temperature": 0
                    },
                    "position": {"x": 1250, "y": 200},
                },
                {
                    "name": "Check Results",
                    "type": "Code",
                    "parameters": {
                        "code": '''# Parse evaluation results and check if target is met
response = json_data.get("response", "")
prev_state = node_data.get("Optimization Loop", {}).get("json", {})

# Parse evaluation results
evaluation = {"accuracy": 0, "results": [], "errors": []}
try:
    import re, json
    match = re.search(r'\\{[\\s\\S]*\\}', response)
    if match:
        evaluation = json.loads(match.group())
except:
    pass

accuracy = evaluation.get("accuracy", 0)
iteration = prev_state.get("iteration", 0) + 1
target = prev_state.get("target_accuracy", 0.8)
max_iter = prev_state.get("max_iterations", 3)

target_met = accuracy >= target
max_reached = iteration >= max_iter
done = target_met or max_reached

return {
    "prompt": prev_state.get("prompt", ""),
    "version": prev_state.get("version", "1.0"),
    "iteration": iteration,
    "test_data": prev_state.get("test_data", []),
    "categories": prev_state.get("categories", []),
    "target_accuracy": target,
    "max_iterations": max_iter,
    "evaluation": evaluation,
    "accuracy": accuracy,
    "target_met": target_met,
    "done": done,
    "history": prev_state.get("history", [])
}'''
                    },
                    "position": {"x": 1500, "y": 200},
                },
                {
                    "name": "Target Met?",
                    "type": "If",
                    "parameters": {
                        "conditions": [
                            {"field": "{{ $json.done }}", "operation": "equals", "value": True}
                        ]
                    },
                    "position": {"x": 1750, "y": 200},
                },
                {
                    "name": "Optimize Prompt",
                    "type": "LLMChat",
                    "parameters": {
                        "model": "gemini-2.0-flash",
                        "systemPrompt": "You are a prompt optimization expert. Improve the classification prompt based on evaluation errors.\n\nAnalyze the misclassifications and generate an improved prompt that better handles these cases.\n\nReturn ONLY valid JSON:\n{\n  \"prompt\": \"the improved classification prompt with [INPUT] placeholder\",\n  \"changes\": [\"list of specific changes made\"]\n}",
                        "userMessage": "Current prompt (v{{ $json.version }}):\n{{ $json.prompt }}\n\nCurrent accuracy: {{ $json.accuracy }}\nTarget accuracy: {{ $json.target_accuracy }}\n\nMisclassified examples:\n{{ $json.evaluation.errors }}\n\nImprove the prompt to correctly classify these cases. Focus on:\n1. Clearer category boundaries\n2. Better handling of edge cases\n3. More specific instructions for ambiguous inputs",
                        "temperature": 0.4
                    },
                    "position": {"x": 1750, "y": 400},
                },
                {
                    "name": "Apply Optimization",
                    "type": "Code",
                    "parameters": {
                        "code": '''# Parse optimized prompt and update state
response = json_data.get("response", "")
prev_state = node_data.get("Check Results", {}).get("json", {})

# Parse optimization result
new_prompt = prev_state.get("prompt", "")
changes = []
try:
    import re, json
    match = re.search(r'\\{[\\s\\S]*\\}', response)
    if match:
        parsed = json.loads(match.group())
        new_prompt = parsed.get("prompt", new_prompt)
        changes = parsed.get("changes", [])
except:
    pass

# Increment version
version = prev_state.get("version", "1.0")
parts = version.split(".")
new_version = f"{parts[0]}.{int(parts[1]) + 1}"

# Update history
history = prev_state.get("history", [])
history.append({
    "version": version,
    "accuracy": prev_state.get("accuracy", 0),
    "changes": changes
})

return {
    "prompt": new_prompt,
    "version": new_version,
    "iteration": prev_state.get("iteration", 0),
    "test_data": prev_state.get("test_data", []),
    "categories": prev_state.get("categories", []),
    "target_accuracy": prev_state.get("target_accuracy", 0.8),
    "max_iterations": prev_state.get("max_iterations", 3),
    "done": False,
    "history": history
}'''
                    },
                    "position": {"x": 2000, "y": 400},
                },
                {
                    "name": "Build Report",
                    "type": "Code",
                    "parameters": {
                        "code": '''# Build final HTML report
d = json_data

status = "TARGET ACHIEVED" if d.get("target_met") else "MAX ITERATIONS"
status_color = "#059669" if d.get("target_met") else "#d97706"
status_bg = "#ecfdf5" if d.get("target_met") else "#fffbeb"

accuracy = d.get("accuracy", 0)
accuracy_pct = round(accuracy * 100, 1)
target_pct = round(d.get("target_accuracy", 0.8) * 100, 1)

# Build history HTML
history_html = ""
for h in d.get("history", []):
    acc = round(h.get("accuracy", 0) * 100, 1)
    history_html += f"""<div style="padding:12px 16px;background:#f8fafc;border-radius:8px;margin-bottom:8px;">
    <div style="display:flex;justify-content:space-between;">
        <span style="font-weight:600;">Version {h.get("version")}</span>
        <span style="color:#6b7280;">{acc}%</span>
    </div>
    <div style="font-size:12px;color:#6b7280;margin-top:4px;">{", ".join(h.get("changes", [])[:2]) or "Initial version"}</div>
</div>"""

# Escape prompt for HTML display
prompt_display = d.get("prompt", "").replace("<", "&lt;").replace(">", "&gt;")

html = f"""<!DOCTYPE html>
<html>
<head></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f1f5f9;margin:0;padding:40px 20px;">
<div style="max-width:900px;margin:0 auto;">

<!-- Header -->
<div style="background:linear-gradient(135deg,#7c3aed 0%,#a855f7 100%);color:white;padding:32px 40px;border-radius:16px 16px 0 0;">
<div style="font-size:12px;opacity:0.8;text-transform:uppercase;letter-spacing:1px;">Prompt Optimization Report</div>
<div style="font-size:28px;font-weight:700;margin-top:8px;">Classification Prompt Generator</div>
</div>

<!-- Status Banner -->
<div style="background:{status_bg};padding:24px 40px;border-bottom:3px solid {status_color};display:flex;justify-content:space-between;align-items:center;">
<div>
<div style="font-size:12px;color:#6b7280;text-transform:uppercase;">Status</div>
<div style="font-size:24px;font-weight:700;color:{status_color};">{status}</div>
</div>
<div style="text-align:right;">
<div style="font-size:12px;color:#6b7280;text-transform:uppercase;">Final Accuracy</div>
<div style="font-size:32px;font-weight:700;color:{status_color};">{accuracy_pct}%</div>
</div>
</div>

<!-- Metrics -->
<div style="background:white;padding:32px 40px;display:grid;grid-template-columns:repeat(4,1fr);gap:20px;border-bottom:1px solid #e5e7eb;">
<div style="text-align:center;padding:16px;background:#f8fafc;border-radius:12px;">
<div style="font-size:12px;color:#6b7280;text-transform:uppercase;">Version</div>
<div style="font-size:24px;font-weight:700;color:#7c3aed;margin-top:4px;">{d.get("version")}</div>
</div>
<div style="text-align:center;padding:16px;background:#f8fafc;border-radius:12px;">
<div style="font-size:12px;color:#6b7280;text-transform:uppercase;">Iterations</div>
<div style="font-size:24px;font-weight:700;color:#7c3aed;margin-top:4px;">{d.get("iteration")}</div>
</div>
<div style="text-align:center;padding:16px;background:#f8fafc;border-radius:12px;">
<div style="font-size:12px;color:#6b7280;text-transform:uppercase;">Target</div>
<div style="font-size:24px;font-weight:700;color:#7c3aed;margin-top:4px;">{target_pct}%</div>
</div>
<div style="text-align:center;padding:16px;background:#f8fafc;border-radius:12px;">
<div style="font-size:12px;color:#6b7280;text-transform:uppercase;">Test Cases</div>
<div style="font-size:24px;font-weight:700;color:#7c3aed;margin-top:4px;">{len(d.get("test_data", []))}</div>
</div>
</div>

<!-- Version History -->
<div style="background:white;padding:32px 40px;border-bottom:1px solid #e5e7eb;">
<div style="font-size:18px;font-weight:600;margin-bottom:20px;">Optimization History</div>
{history_html if history_html else "<div style='color:#6b7280;'>Initial version - no optimization needed</div>"}
</div>

<!-- Final Prompt -->
<div style="background:white;padding:32px 40px;border-bottom:1px solid #e5e7eb;">
<div style="font-size:18px;font-weight:600;margin-bottom:16px;">Final Optimized Prompt</div>
<div style="background:#1e1e1e;color:#d4d4d4;padding:20px;border-radius:8px;font-family:monospace;font-size:13px;white-space:pre-wrap;overflow-x:auto;max-height:400px;overflow-y:auto;">{prompt_display}</div>
</div>

<!-- Footer -->
<div style="background:#f0f9ff;padding:20px 40px;border-radius:0 0 16px 16px;text-align:center;">
<div style="color:#0c4a6e;font-size:14px;">Generated by Workflow Engine | Prompt Optimization Pipeline</div>
</div>

</div>
</body>
</html>"""

return {"html": html, "prompt": d.get("prompt"), "version": d.get("version"), "accuracy": accuracy}'''
                    },
                    "position": {"x": 2000, "y": 200},
                },
                {
                    "name": "Respond",
                    "type": "RespondToWebhook",
                    "parameters": {
                        "statusCode": "200",
                        "responseMode": "lastNode",
                        "responseField": "html",
                        "contentType": "text/html",
                        "wrapResponse": False
                    },
                    "position": {"x": 2250, "y": 300},
                },
            ],
            "connections": [
                {"source_node": "Input", "target_node": "Setup Requirements"},
                {"source_node": "Setup Requirements", "target_node": "Generate Initial Prompt"},
                {"source_node": "Generate Initial Prompt", "target_node": "Initialize State"},
                {"source_node": "Initialize State", "target_node": "Optimization Loop"},
                {"source_node": "Optimization Loop", "target_node": "Evaluate Prompt", "source_output": "loop"},
                {"source_node": "Evaluate Prompt", "target_node": "Check Results"},
                {"source_node": "Check Results", "target_node": "Target Met?"},
                {"source_node": "Target Met?", "target_node": "Build Report", "source_output": "true"},
                {"source_node": "Target Met?", "target_node": "Optimize Prompt", "source_output": "false"},
                {"source_node": "Optimize Prompt", "target_node": "Apply Optimization"},
                {"source_node": "Apply Optimization", "target_node": "Optimization Loop"},
                {"source_node": "Optimization Loop", "target_node": "Build Report", "source_output": "done"},
                {"source_node": "Build Report", "target_node": "Respond"},
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
