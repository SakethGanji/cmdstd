"""HTTP Request node - makes HTTP requests to external APIs."""

from __future__ import annotations

from typing import Any, TYPE_CHECKING

import httpx

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


class HttpRequestNode(BaseNode):
    """HTTP Request node - makes HTTP requests to external APIs."""

    node_description = NodeTypeDescription(
        name="HttpRequest",
        display_name="HTTP Request",
        description="Makes HTTP requests to external APIs",
        icon="fa:globe",
        group=["transform"],
        inputs=[NodeInputDefinition(name="main", display_name="Input")],
        outputs=[
            NodeOutputDefinition(
                name="main",
                display_name="Response",
                schema={
                    "type": "object",
                    "properties": {
                        "statusCode": {"type": "number", "description": "HTTP status code"},
                        "headers": {"type": "object", "description": "Response headers"},
                        "body": {"type": "unknown", "description": "Response body"},
                    },
                },
            )
        ],
        properties=[
            NodeProperty(
                display_name="Method",
                name="method",
                type="options",
                default="GET",
                required=True,
                options=[
                    NodePropertyOption(name="GET", value="GET"),
                    NodePropertyOption(name="POST", value="POST"),
                    NodePropertyOption(name="PUT", value="PUT"),
                    NodePropertyOption(name="PATCH", value="PATCH"),
                    NodePropertyOption(name="DELETE", value="DELETE"),
                    NodePropertyOption(name="HEAD", value="HEAD"),
                ],
            ),
            NodeProperty(
                display_name="URL",
                name="url",
                type="string",
                default="",
                required=True,
                placeholder="https://api.example.com/endpoint",
                description="The URL to make the request to. Supports expressions.",
            ),
            NodeProperty(
                display_name="Headers",
                name="headers",
                type="collection",
                default=[],
                description="HTTP headers to send with the request",
                type_options={"multipleValues": True},
                properties=[
                    NodeProperty(
                        display_name="Header Name",
                        name="name",
                        type="string",
                        default="",
                        placeholder="Content-Type",
                    ),
                    NodeProperty(
                        display_name="Header Value",
                        name="value",
                        type="string",
                        default="",
                        placeholder="application/json",
                    ),
                ],
            ),
            NodeProperty(
                display_name="Body",
                name="body",
                type="json",
                default="",
                description="Request body (for POST, PUT, PATCH)",
                type_options={"language": "json", "rows": 10},
                display_options={"show": {"method": ["POST", "PUT", "PATCH"]}},
            ),
            NodeProperty(
                display_name="Response Type",
                name="responseType",
                type="options",
                default="json",
                options=[
                    NodePropertyOption(
                        name="JSON",
                        value="json",
                        description="Parse response as JSON",
                    ),
                    NodePropertyOption(
                        name="Text",
                        value="text",
                        description="Return raw text",
                    ),
                    NodePropertyOption(
                        name="Binary",
                        value="binary",
                        description="Return binary data",
                    ),
                ],
            ),
        ],
    )

    @property
    def type(self) -> str:
        return "HttpRequest"

    @property
    def description(self) -> str:
        return "Makes HTTP requests to external APIs"

    async def execute(
        self,
        context: ExecutionContext,
        node_definition: NodeDefinition,
        input_data: list[NodeData],
    ) -> NodeExecutionResult:
        from ..engine.types import NodeData

        url = self.get_parameter(node_definition, "url")
        method = self.get_parameter(node_definition, "method", "GET")
        response_type = self.get_parameter(node_definition, "responseType", "json")

        # Process headers
        headers_param = self.get_parameter(node_definition, "headers", [])
        headers: dict[str, str] = {"Content-Type": "application/json"}

        if isinstance(headers_param, list):
            for h in headers_param:
                if h.get("name"):
                    headers[h["name"]] = h.get("value", "")
        elif isinstance(headers_param, dict):
            headers.update(headers_param)

        # Process body
        body = None
        if method in ("POST", "PUT", "PATCH"):
            body = node_definition.parameters.get("body")
            if isinstance(body, str) and body:
                import json
                try:
                    body = json.loads(body)
                except json.JSONDecodeError:
                    pass  # Keep as string

        results: list[NodeData] = []
        items = input_data if input_data else [NodeData(json={})]

        async def make_requests(client: httpx.AsyncClient) -> None:
            for _item in items:
                response = await client.request(
                    method=method,
                    url=url,
                    headers=headers,
                    json=body if isinstance(body, dict) else None,
                    content=body if isinstance(body, str) else None,
                )

                response_data: Any
                if response_type == "text":
                    response_data = response.text
                elif response_type == "binary":
                    response_data = {
                        "_binary": True,
                        "size": len(response.content),
                    }
                else:
                    try:
                        response_data = response.json()
                    except Exception:
                        response_data = {}

                results.append(
                    NodeData(json={
                        "statusCode": response.status_code,
                        "headers": dict(response.headers),
                        "body": response_data,
                    })
                )

        if hasattr(context, "http_client") and context.http_client:
             await make_requests(context.http_client)
        else:
             async with httpx.AsyncClient() as client:
                 await make_requests(client)

        return self.output(results)
