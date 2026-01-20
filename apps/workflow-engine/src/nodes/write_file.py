"""WriteFile node - write data to files on disk."""

from __future__ import annotations

import csv
import json
import os
from io import StringIO
from pathlib import Path
from typing import Any, TYPE_CHECKING

from .base import (
    BaseNode,
    NodeTypeDescription,
    NodeInputDefinition,
    NodeOutputDefinition,
    NodeProperty,
    NodePropertyOption,
)

if TYPE_CHECKING:
    from ..engine.types import ExecutionContext, NodeDefinition, NodeExecutionResult

from ..engine.types import NodeData
from ..engine.expression_engine import expression_engine, ExpressionEngine


class WriteFileNode(BaseNode):
    """Write data to files on disk."""

    node_description = NodeTypeDescription(
        name="WriteFile",
        display_name="Write File",
        description="Write data to a file (JSON, CSV, or text)",
        icon="fa:file-export",
        group=["output"],
        inputs=[NodeInputDefinition(name="main", display_name="Input")],
        outputs=[
            NodeOutputDefinition(
                name="main",
                display_name="Output",
                schema={
                    "type": "object",
                    "properties": {
                        "filePath": {"type": "string"},
                        "bytesWritten": {"type": "number"},
                        "status": {"type": "string"},
                    },
                },
            ),
        ],
        properties=[
            NodeProperty(
                display_name="File Path",
                name="filePath",
                type="string",
                default="",
                placeholder="/path/to/output.json",
                description="Path to write the file. Supports expressions like {{ $json.filename }}",
                required=True,
            ),
            NodeProperty(
                display_name="Format",
                name="format",
                type="options",
                default="json",
                options=[
                    NodePropertyOption(
                        name="JSON",
                        value="json",
                        description="Write as JSON (single object or array)",
                    ),
                    NodePropertyOption(
                        name="JSON Lines",
                        value="jsonl",
                        description="Write as JSON Lines (one JSON object per line)",
                    ),
                    NodePropertyOption(
                        name="CSV",
                        value="csv",
                        description="Write as CSV file",
                    ),
                    NodePropertyOption(
                        name="Text",
                        value="text",
                        description="Write as plain text",
                    ),
                ],
            ),
            NodeProperty(
                display_name="Write Mode",
                name="writeMode",
                type="options",
                default="overwrite",
                options=[
                    NodePropertyOption(
                        name="Overwrite",
                        value="overwrite",
                        description="Replace file if it exists",
                    ),
                    NodePropertyOption(
                        name="Append",
                        value="append",
                        description="Add to end of file",
                    ),
                ],
            ),
            NodeProperty(
                display_name="Data Field",
                name="dataField",
                type="string",
                default="",
                placeholder="data",
                description="Field containing data to write. Leave empty to write entire item.",
                display_options={"show": {"format": ["json", "jsonl", "text"]}},
            ),
            NodeProperty(
                display_name="Text Field",
                name="textField",
                type="string",
                default="text",
                placeholder="text",
                description="Field containing text to write",
                display_options={"show": {"format": ["text"]}},
            ),
            NodeProperty(
                display_name="CSV Columns",
                name="csvColumns",
                type="string",
                default="",
                placeholder="name,email,score",
                description="Comma-separated list of columns. Leave empty to include all fields.",
                display_options={"show": {"format": ["csv"]}},
            ),
            NodeProperty(
                display_name="Include Header",
                name="includeHeader",
                type="boolean",
                default=True,
                description="Include column headers in CSV",
                display_options={"show": {"format": ["csv"]}},
            ),
            NodeProperty(
                display_name="Create Directories",
                name="createDirs",
                type="boolean",
                default=True,
                description="Create parent directories if they don't exist",
            ),
            NodeProperty(
                display_name="Pretty Print",
                name="prettyPrint",
                type="boolean",
                default=True,
                description="Format JSON with indentation",
                display_options={"show": {"format": ["json"]}},
            ),
        ],
    )

    @property
    def type(self) -> str:
        return "WriteFile"

    @property
    def description(self) -> str:
        return "Write data to a file (JSON, CSV, or text)"

    async def execute(
        self,
        context: ExecutionContext,
        node_definition: NodeDefinition,
        input_data: list[NodeData],
    ) -> NodeExecutionResult:
        file_path_template = self.get_parameter(node_definition, "filePath", "")
        format_type = self.get_parameter(node_definition, "format", "json")
        write_mode = self.get_parameter(node_definition, "writeMode", "overwrite")
        data_field = self.get_parameter(node_definition, "dataField", "")
        text_field = self.get_parameter(node_definition, "textField", "text")
        csv_columns = self.get_parameter(node_definition, "csvColumns", "")
        include_header = self.get_parameter(node_definition, "includeHeader", True)
        create_dirs = self.get_parameter(node_definition, "createDirs", True)
        pretty_print = self.get_parameter(node_definition, "prettyPrint", True)

        if not file_path_template:
            raise ValueError("File path is required")

        # Resolve file path expression
        expr_context = ExpressionEngine.create_context(
            input_data,
            context.node_states,
            context.execution_id,
            item_index=0,
        )
        file_path = expression_engine.resolve(file_path_template, expr_context)
        file_path = str(file_path)

        # Create directories if needed
        path = Path(file_path)
        if create_dirs:
            path.parent.mkdir(parents=True, exist_ok=True)

        # Prepare data to write
        if format_type == "json":
            content = self._write_json(input_data, data_field, pretty_print)
        elif format_type == "jsonl":
            content = self._write_jsonl(input_data, data_field)
        elif format_type == "csv":
            content = self._write_csv(input_data, csv_columns, include_header)
        elif format_type == "text":
            content = self._write_text(input_data, text_field)
        else:
            content = str(input_data)

        # Write to file
        mode = "a" if write_mode == "append" else "w"
        with open(file_path, mode, encoding="utf-8") as f:
            f.write(content)
            bytes_written = f.tell()

        return self.output([
            NodeData(json={
                "filePath": file_path,
                "bytesWritten": bytes_written,
                "status": "success",
                "format": format_type,
                "mode": write_mode,
            })
        ])

    def _write_json(self, input_data: list[NodeData], data_field: str, pretty: bool) -> str:
        """Write data as JSON."""
        if data_field:
            # Write specific field from each item
            data = [self._get_nested_value(item.json, data_field) for item in input_data]
        else:
            # Write entire items
            data = [item.json for item in input_data]

        # If single item, don't wrap in array
        if len(data) == 1:
            data = data[0]

        indent = 2 if pretty else None
        return json.dumps(data, indent=indent, default=str, ensure_ascii=False)

    def _write_jsonl(self, input_data: list[NodeData], data_field: str) -> str:
        """Write data as JSON Lines (one object per line)."""
        lines = []
        for item in input_data:
            if data_field:
                data = self._get_nested_value(item.json, data_field)
            else:
                data = item.json
            lines.append(json.dumps(data, default=str, ensure_ascii=False))
        return "\n".join(lines) + "\n"

    def _write_csv(self, input_data: list[NodeData], columns_str: str, include_header: bool) -> str:
        """Write data as CSV."""
        if not input_data:
            return ""

        # Determine columns
        if columns_str:
            columns = [c.strip() for c in columns_str.split(",")]
        else:
            # Auto-detect from first item
            columns = list(input_data[0].json.keys())

        output = StringIO()
        writer = csv.DictWriter(output, fieldnames=columns, extrasaction="ignore")

        if include_header:
            writer.writeheader()

        for item in input_data:
            # Flatten nested values to strings
            row = {}
            for col in columns:
                value = self._get_nested_value(item.json, col)
                if isinstance(value, (dict, list)):
                    row[col] = json.dumps(value, default=str)
                else:
                    row[col] = value
            writer.writerow(row)

        return output.getvalue()

    def _write_text(self, input_data: list[NodeData], text_field: str) -> str:
        """Write data as plain text."""
        lines = []
        for item in input_data:
            if text_field:
                value = self._get_nested_value(item.json, text_field)
            else:
                value = item.json
            lines.append(str(value) if value is not None else "")
        return "\n".join(lines)

    def _get_nested_value(self, obj: dict[str, Any], path: str) -> Any:
        """Get value at nested path."""
        if not path:
            return obj
        current: Any = obj
        for key in path.split("."):
            if isinstance(current, dict):
                current = current.get(key)
            elif isinstance(current, list) and key.isdigit():
                idx = int(key)
                current = current[idx] if 0 <= idx < len(current) else None
            else:
                return None
        return current
