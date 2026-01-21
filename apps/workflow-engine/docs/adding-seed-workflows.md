# Adding Workflows to Seed Data

This guide explains how to add workflows to the seed data so they're available as examples/demos.

## Quick Steps

1. **Export your workflow** from the UI
2. **Add it to `seed.py`**
3. **Run the seed command**

---

## Step 1: Export from UI

1. Open your workflow in the editor
2. Click the **⋯** menu (top-right corner)
3. Click **Export workflow**
4. A JSON file downloads (e.g., `my-workflow.json`)

## Step 2: Add to seed.py

Open `apps/workflow-engine/src/db/seed.py` and add your workflow to the `EXAMPLE_WORKFLOWS` list:

```python
EXAMPLE_WORKFLOWS = [
    # ... existing workflows ...

    # Your new workflow
    {
        "name": "My Workflow Name",
        "description": "Brief description of what it does",
        "active": True,  # Set True if it has a Webhook trigger
        "definition": {
            # Paste the contents of your exported JSON here
            "nodes": [...],
            "connections": [...],
            "settings": {}
        }
    },
]
```

### Field Reference

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Display name (must be unique) |
| `description` | No | Short description shown in UI |
| `active` | No | Set `True` for webhook-triggered workflows |
| `id` | No | Fixed ID for subworkflow references (e.g., `"wf_seed_my_workflow"`) |
| `definition` | Yes | The workflow definition (nodes, connections, settings) |

### Example: Webhook Workflow

```python
{
    "name": "Echo API",
    "description": "Returns the input data back. Test with POST to /webhook/{id}",
    "active": True,
    "definition": {
        "nodes": [
            {
                "name": "Webhook",
                "type": "Webhook",
                "parameters": {"method": "POST", "responseMode": "lastNode"},
                "position": {"x": 100, "y": 200},
            },
            {
                "name": "Echo",
                "type": "Set",
                "parameters": {
                    "mode": "manual",
                    "fields": [
                        {"name": "received", "value": "{{ $json.body }}"},
                    ],
                },
                "position": {"x": 350, "y": 200},
            },
        ],
        "connections": [
            {"source_node": "Webhook", "target_node": "Echo"},
        ],
        "settings": {},
    },
},
```

### Example: Manual Workflow (Start trigger)

```python
{
    "name": "Hello World",
    "description": "Simple workflow that outputs a greeting",
    "active": False,  # No webhook, run manually
    "definition": {
        "nodes": [
            {
                "name": "Start",
                "type": "Start",
                "parameters": {},
                "position": {"x": 100, "y": 200},
            },
            {
                "name": "Greet",
                "type": "Set",
                "parameters": {
                    "mode": "manual",
                    "fields": [
                        {"name": "message", "value": "Hello, World!"},
                    ],
                },
                "position": {"x": 350, "y": 200},
            },
        ],
        "connections": [
            {"source_node": "Start", "target_node": "Greet"},
        ],
        "settings": {},
    },
},
```

## Step 3: Run Seed Command

```bash
cd apps/workflow-engine
python -m src.db.seed
```

This will:
- Clear all existing workflows
- Add all workflows from `EXAMPLE_WORKFLOWS`

---

## Tips

### Referencing Subworkflows

If workflow A calls workflow B via `ExecuteWorkflow` node, give B a fixed ID:

```python
# Subworkflow (called by others)
{
    "id": "wf_seed_data_processor",  # Fixed ID
    "name": "Data Processor",
    ...
}

# Parent workflow
{
    "name": "Main Workflow",
    "definition": {
        "nodes": [
            {
                "name": "Call Processor",
                "type": "ExecuteWorkflow",
                "parameters": {
                    "workflowId": "wf_seed_data_processor",  # Reference the fixed ID
                },
                ...
            },
        ],
        ...
    },
}
```

### Testing Webhook Workflows

Workflows with `"active": True` can be triggered via:

```bash
curl -X POST http://localhost:8000/webhook/{workflow_id} \
  -H "Content-Type: application/json" \
  -d '{"key": "value"}'
```

### Alternative: Export from Database

If you prefer to export directly from the database:

```bash
cd apps/workflow-engine
python -c "
import sqlite3
import json

conn = sqlite3.connect('workflows.db')
name = 'Your Workflow Name'
row = conn.execute(
    'SELECT name, description, active, definition FROM workflows WHERE name = ?',
    (name,)
).fetchone()

if row:
    print(json.dumps({
        'name': row[0],
        'description': row[1] or '',
        'active': bool(row[2]),
        'definition': json.loads(row[3])
    }, indent=2))
else:
    print(f'Workflow not found: {name}')
"
```
