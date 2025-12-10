# Workflow Engine (Python)

A Python port of the TypeScript workflow engine using Prefect 3.0 and FastAPI.

## Installation

```bash
pip install -e .
```

## Running

```bash
python -m src.main
```

Server runs on http://localhost:3001

## API Endpoints

- `GET /api/workflows` - List workflows
- `POST /api/workflows` - Create workflow
- `POST /api/workflows/:id/run` - Execute workflow
- `POST /webhook/:id` - Trigger via webhook
- `GET /api/nodes` - List node types
