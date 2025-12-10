"""PandasExplore node - analyzes CSV data using pandas."""

from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING

from .base import (
    BaseNode,
    NodeTypeDescription,
    NodeInputDefinition,
    NodeOutputDefinition,
    NodeProperty,
    NodePropertyOption,
)

if TYPE_CHECKING:
    from ..engine.types import (
        ExecutionContext,
        NodeData,
        NodeDefinition,
        NodeExecutionResult,
    )


class PandasExploreNode(BaseNode):
    """
    PandasExplore Node.

    Analyzes CSV data using pandas and returns HTML output for display.
    Since we're now in Python, we can use pandas directly instead of spawning a subprocess.
    """

    node_description = NodeTypeDescription(
        name="PandasExplore",
        display_name="Pandas Explore",
        icon="fa:chart-bar",
        description="Analyzes CSV data using Python pandas and returns HTML report",
        group=["transform"],
        inputs=[NodeInputDefinition(name="main", display_name="Input")],
        outputs=[
            NodeOutputDefinition(
                name="main",
                display_name="HTML Output",
                schema={
                    "type": "object",
                    "properties": {
                        "html": {"type": "string", "description": "HTML report from pandas analysis"},
                        "_renderAs": {"type": "string", "description": "Render hint for frontend"},
                    },
                },
            )
        ],
        properties=[
            NodeProperty(
                display_name="File Path",
                name="filePath",
                type="string",
                default="={{ $json.filePath }}",
                required=True,
                placeholder="/path/to/data.csv",
                description="Path to the CSV file. Use expression to get from previous node: {{ $json.filePath }}",
            ),
            NodeProperty(
                display_name="Analysis Type",
                name="analysisType",
                type="options",
                default="profile",
                required=True,
                options=[
                    NodePropertyOption(name="Profile (Summary + Preview)", value="profile"),
                    NodePropertyOption(name="Describe (Statistics Only)", value="describe"),
                    NodePropertyOption(name="Info (Data Preview Only)", value="info"),
                ],
                description="Type of pandas analysis to perform",
            ),
        ],
    )

    @property
    def type(self) -> str:
        return "PandasExplore"

    @property
    def description(self) -> str:
        return "Analyzes CSV data using Python pandas"

    async def execute(
        self,
        context: ExecutionContext,
        node_definition: NodeDefinition,
        input_data: list[NodeData],
    ) -> NodeExecutionResult:
        from ..engine.types import NodeData as ND

        file_path = self.get_parameter(node_definition, "filePath")
        analysis_type = self.get_parameter(node_definition, "analysisType", "profile")

        if not file_path:
            raise ValueError(
                "Missing file path. Configure the filePath parameter with a path or expression like {{ $json.filePath }}"
            )

        results: list[ND] = []
        items = input_data if input_data else [ND(json={})]

        for _ in items:
            html = self._analyze_csv(file_path, analysis_type)
            results.append(ND(json={"html": html, "_renderAs": "html"}))

        return self.output(results)

    def _analyze_csv(self, file_path: str, analysis_type: str) -> str:
        """Analyze CSV file and return HTML report."""
        try:
            import pandas as pd
        except ImportError:
            raise RuntimeError(
                "pandas is required for PandasExplore node. Install with: pip install pandas"
            )

        # Verify file exists
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        # Read the CSV file
        try:
            df = pd.read_csv(file_path)
        except pd.errors.EmptyDataError:
            raise ValueError("CSV file is empty")
        except Exception as e:
            raise RuntimeError(f"Error reading CSV file: {e}")

        # Generate HTML based on analysis type
        html_parts = []

        # Add basic styling
        html_parts.append("""
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; }
            h2 { color: #333; border-bottom: 2px solid #eee; padding-bottom: 10px; }
            table { border-collapse: collapse; width: 100%; margin: 20px 0; }
            th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
            th { background-color: #f5f5f5; font-weight: 600; }
            tr:nth-child(even) { background-color: #fafafa; }
            tr:hover { background-color: #f0f0f0; }
            .info { background: #e7f3ff; padding: 15px; border-radius: 8px; margin: 10px 0; }
        </style>
        """)

        # Dataset info
        html_parts.append(f"""
        <div class="info">
            <strong>Dataset:</strong> {file_path}<br>
            <strong>Shape:</strong> {df.shape[0]} rows × {df.shape[1]} columns<br>
            <strong>Columns:</strong> {', '.join(df.columns.tolist())}
        </div>
        """)

        if analysis_type == "describe":
            html_parts.append("<h2>Statistical Summary</h2>")
            html_parts.append(df.describe(include='all').to_html())

        elif analysis_type == "info":
            html_parts.append("<h2>Data Preview (First 20 Rows)</h2>")
            html_parts.append(df.head(20).to_html(index=False))

        else:  # profile - combined view
            html_parts.append("<h2>Statistical Summary</h2>")
            html_parts.append(df.describe(include='all').to_html())
            html_parts.append("<h2>Data Preview (First 10 Rows)</h2>")
            html_parts.append(df.head(10).to_html(index=False))

        return "\n".join(html_parts)
