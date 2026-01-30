"""SQLite node - executes parameterized queries against a SQLite database."""

from __future__ import annotations

import json
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from typing import Any, TYPE_CHECKING

import aiosqlite

from .base import (
    BaseNode,
    NodeTypeDescription,
    NodeInputDefinition,
    NodeOutputDefinition,
    NodeProperty,
    NodePropertyOption,
)

if TYPE_CHECKING:
    from ..engine.types import ExecutionContext, NodeData, NodeDefinition, NodeExecutionResult


def _serialize_value(val: Any) -> Any:
    """Convert Python types to JSON-safe values."""
    if isinstance(val, Decimal):
        return float(val)
    if isinstance(val, (datetime, date, time)):
        return val.isoformat()
    if isinstance(val, timedelta):
        return val.total_seconds()
    if isinstance(val, bytes):
        return val.hex()
    if isinstance(val, list):
        return [_serialize_value(v) for v in val]
    if isinstance(val, dict):
        return {k: _serialize_value(v) for k, v in val.items()}
    return val


class SQLiteNode(BaseNode):
    """SQLite node - executes parameterized queries against a SQLite database."""

    node_description = NodeTypeDescription(
        name="SQLite",
        display_name="SQLite",
        description="Execute parameterized queries against a SQLite database",
        icon="fa:database",
        group=["transform"],
        inputs=[NodeInputDefinition(name="main", display_name="Input")],
        outputs=[
            NodeOutputDefinition(
                name="main",
                display_name="Output",
                schema={
                    "type": "object",
                    "properties": {
                        "rows": {"type": "array", "description": "Query result rows"},
                        "rowCount": {"type": "number", "description": "Number of rows returned or affected"},
                    },
                },
            )
        ],
        properties=[
            NodeProperty(
                display_name="Database Path",
                name="databasePath",
                type="string",
                default="",
                required=True,
                description="Path to the SQLite database file. Use :memory: for in-memory. Supports expressions.",
                placeholder="/path/to/database.db",
            ),
            NodeProperty(
                display_name="Operation",
                name="operation",
                type="options",
                default="executeQuery",
                options=[
                    NodePropertyOption(
                        name="Execute Query",
                        value="executeQuery",
                        description="Run a SELECT query and return rows",
                    ),
                    NodePropertyOption(
                        name="Execute Statement",
                        value="executeStatement",
                        description="Run an INSERT/UPDATE/DELETE and return affected row count",
                    ),
                ],
            ),
            NodeProperty(
                display_name="Query",
                name="query",
                type="string",
                default="",
                required=True,
                description="SQL query with ? placeholders. Supports expressions.",
                type_options={"rows": 5},
            ),
            NodeProperty(
                display_name="Query Parameters",
                name="queryParameters",
                type="json",
                default="[]",
                description="JSON array of positional parameters for ? placeholders. Supports expressions.",
                type_options={"language": "json", "rows": 4},
            ),
        ],
    )

    @property
    def type(self) -> str:
        return "SQLite"

    @property
    def description(self) -> str:
        return "Execute parameterized queries against a SQLite database"

    async def execute(
        self,
        context: ExecutionContext,
        node_definition: NodeDefinition,
        input_data: list[NodeData],
    ) -> NodeExecutionResult:
        from ..engine.types import NodeData as NodeDataClass
        from ..engine.expression_engine import ExpressionEngine, expression_engine

        db_path_template = self.get_parameter(node_definition, "databasePath", "")
        operation = self.get_parameter(node_definition, "operation", "executeQuery")
        query_template = self.get_parameter(node_definition, "query", "")
        params_template = self.get_parameter(node_definition, "queryParameters", "[]")

        results: list[NodeDataClass] = []
        items = input_data if input_data else [NodeDataClass(json={})]

        for idx, item in enumerate(items):
            expr_context = ExpressionEngine.create_context(
                input_data,
                context.node_states,
                context.execution_id,
                idx,
            )

            db_path = expression_engine.resolve(db_path_template, expr_context)
            query = expression_engine.resolve(query_template, expr_context)
            params_raw = expression_engine.resolve(params_template, expr_context)

            if isinstance(params_raw, str):
                params = json.loads(params_raw) if params_raw.strip() else []
            elif isinstance(params_raw, list):
                params = params_raw
            else:
                params = []

            async with aiosqlite.connect(str(db_path)) as db:
                db.row_factory = aiosqlite.Row
                if operation == "executeQuery":
                    cursor = await db.execute(query, params)
                    raw_rows = await cursor.fetchall()
                    columns = [d[0] for d in cursor.description] if cursor.description else []
                    rows = [
                        {col: _serialize_value(row[i]) for i, col in enumerate(columns)}
                        for row in raw_rows
                    ]
                    results.append(NodeDataClass(json={
                        "rows": rows,
                        "rowCount": len(rows),
                    }))
                else:
                    cursor = await db.execute(query, params)
                    await db.commit()
                    results.append(NodeDataClass(json={
                        "success": True,
                        "rowCount": cursor.rowcount,
                    }))

        return self.output(results)
