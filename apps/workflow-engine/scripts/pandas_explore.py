#!/usr/bin/env python3
"""
Pandas Explore Script

Reads a CSV file and performs pandas analysis, returning HTML output.

Usage:
    python pandas_explore.py '{"filePath": "/path/to/data.csv", "analysisType": "describe"}'

Analysis Types:
    - describe: Statistical summary (df.describe())
    - info: First 20 rows preview (df.head(20))
    - profile: Combined describe + head preview
"""

import sys
import json
import pandas as pd


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No input provided"}), file=sys.stderr)
        sys.exit(1)

    try:
        input_data = json.loads(sys.argv[1])
    except json.JSONDecodeError as e:
        print(json.dumps({"error": f"Invalid JSON input: {e}"}), file=sys.stderr)
        sys.exit(1)

    file_path = input_data.get("filePath")
    analysis_type = input_data.get("analysisType", "describe")

    if not file_path:
        print(json.dumps({"error": "filePath is required"}), file=sys.stderr)
        sys.exit(1)

    try:
        # Read the CSV file
        df = pd.read_csv(file_path)

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

        html = "\n".join(html_parts)
        print(json.dumps({"html": html}))

    except FileNotFoundError:
        print(json.dumps({"error": f"File not found: {file_path}"}), file=sys.stderr)
        sys.exit(1)
    except pd.errors.EmptyDataError:
        print(json.dumps({"error": "CSV file is empty"}), file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(json.dumps({"error": f"Error processing file: {str(e)}"}), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
