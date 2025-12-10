"""
Workflow runner - executes DAG-based workflows.

Uses a queue-based BFS approach for node execution.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Literal

import httpx

logger = logging.getLogger(__name__)

from .expression_engine import ExpressionEngine, expression_engine
from .types import (
    ExecutionContext,
    ExecutionError,
    ExecutionEvent,
    ExecutionEventCallback,
    ExecutionEventType,
    ExecutionJob,
    NodeData,
    NodeDefinition,
    NodeExecutionResult,
    Workflow,
    NO_OUTPUT_SIGNAL,
    NoOutputSignal,
)

if TYPE_CHECKING:
    from .node_registry import NodeRegistryClass


class WorkflowRunner:
    """Executes DAG-based workflows using queue-based processing."""

    def __init__(self) -> None:
        from .node_registry import node_registry
        self._registry: NodeRegistryClass = node_registry

    async def run(
        self,
        workflow: Workflow,
        start_node_name: str,
        initial_data: list[NodeData] | None = None,
        mode: Literal["manual", "webhook", "cron"] = "manual",
        on_event: ExecutionEventCallback | None = None,
    ) -> ExecutionContext:
        """
        Run a workflow from a starting node.

        Args:
            workflow: The workflow definition to execute
            start_node_name: Name of the node to start execution from
            initial_data: Initial input data for the start node
            mode: Execution mode (manual, webhook, cron)
            on_event: Optional callback for real-time execution events

        Returns:
            ExecutionContext with all node states and errors
        """
        if initial_data is None:
            initial_data = [NodeData(json={})]

        context = self._create_context(workflow, mode)
        
        # Shared HTTP client
        async with httpx.AsyncClient(timeout=30.0) as http_client:
            context.http_client = http_client
            
            total_nodes = len(workflow.nodes)
            completed_nodes = 0

        # Build node lookup dict for O(1) access
        node_map: dict[str, NodeDefinition] = {n.name: n for n in workflow.nodes}

        # Emit execution start event
        self._emit_event(
            on_event,
            ExecutionEvent(
                type=ExecutionEventType.EXECUTION_START,
                execution_id=context.execution_id,
                timestamp=datetime.now(),
                progress={"completed": 0, "total": total_nodes},
            ),
        )

        # Find start node
        start_node = node_map.get(start_node_name)
        if not start_node:
            error = f'Start node "{start_node_name}" not found in workflow'
            self._emit_event(
                on_event,
                ExecutionEvent(
                    type=ExecutionEventType.EXECUTION_ERROR,
                    execution_id=context.execution_id,
                    timestamp=datetime.now(),
                    error=error,
                ),
            )
            raise ValueError(error)

        # Initialize job queue with start node
        queue: list[ExecutionJob] = [
            ExecutionJob(
                node_name=start_node_name,
                input_data=initial_data,
                source_node=None,
                source_output="main",
                run_index=0,
            )
        ]

        # Track which nodes have been executed (for progress tracking)
        executed_nodes: set[str] = set()

        # Process jobs until queue is empty
        # Safety limit to prevent infinite loops (configurable via workflow settings)
        iteration = 0
        max_iterations = workflow.settings.get("max_iterations", 1000)

        while queue and iteration < max_iterations:
            iteration += 1
            
            # Process all currently available jobs in parallel (BFS layer)
            current_batch = queue[:]
            queue.clear()
            
            tasks = []
            for job in current_batch:
                # Emit node start event (only first time for each node)
                node_def = node_map.get(job.node_name)
                if node_def and job.node_name not in executed_nodes:
                    self._emit_event(
                        on_event,
                        ExecutionEvent(
                            type=ExecutionEventType.NODE_START,
                            execution_id=context.execution_id,
                            timestamp=datetime.now(),
                            node_name=job.node_name,
                            node_type=node_def.type,
                            progress={"completed": completed_nodes, "total": total_nodes},
                        ),
                    )
                
                tasks.append(self._process_job(context, job, queue, node_map, on_event))

            # Run batch
            results = await asyncio.gather(*tasks, return_exceptions=True)

            # Process results
            for job, result in zip(current_batch, results):
                had_error = False
                if isinstance(result, Exception):
                    logger.error(f"Error processing job {job.node_name}: {result}")
                    had_error = True
                else:
                    had_error = result

                # Track completion and emit node complete event
                node_def = node_map.get(job.node_name)
                if job.node_name not in executed_nodes:
                    executed_nodes.add(job.node_name)
                    completed_nodes += 1

                    if not had_error and node_def:
                        self._emit_event(
                            on_event,
                            ExecutionEvent(
                                type=ExecutionEventType.NODE_COMPLETE,
                                execution_id=context.execution_id,
                                timestamp=datetime.now(),
                                node_name=job.node_name,
                                node_type=node_def.type,
                                data=context.node_states.get(job.node_name),
                                progress={"completed": completed_nodes, "total": total_nodes},
                            ),
                        )

        if iteration >= max_iterations:
            error = "Execution exceeded maximum iterations (possible infinite loop)"
            context.errors.append(
                ExecutionError(
                    node_name="WorkflowRunner",
                    error=error,
                    timestamp=datetime.now(),
                )
            )
            self._emit_event(
                on_event,
                ExecutionEvent(
                    type=ExecutionEventType.EXECUTION_ERROR,
                    execution_id=context.execution_id,
                    timestamp=datetime.now(),
                    error=error,
                ),
            )


        # Emit execution complete event
        self._emit_event(
            on_event,
            ExecutionEvent(
                type=ExecutionEventType.EXECUTION_COMPLETE,
                execution_id=context.execution_id,
                timestamp=datetime.now(),
                progress={"completed": completed_nodes, "total": total_nodes},
            ),
        )

        return context

    def _emit_event(
        self, on_event: ExecutionEventCallback | None, event: ExecutionEvent
    ) -> None:
        """Helper to emit events safely."""
        if on_event:
            try:
                on_event(event)
            except Exception:
                logger.exception("Error in execution event callback")

    async def _process_job(
        self,
        context: ExecutionContext,
        job: ExecutionJob,
        queue: list[ExecutionJob],
        node_map: dict[str, NodeDefinition],
        on_event: ExecutionEventCallback | None = None,
    ) -> bool:
        """
        Process a single execution job.

        Returns True if there was an error, False otherwise.
        """
        node_def = node_map.get(job.node_name)

        if not node_def:
            error = f'Node "{job.node_name}" not found'
            context.errors.append(
                ExecutionError(
                    node_name=job.node_name,
                    error=error,
                    timestamp=datetime.now(),
                )
            )
            self._emit_event(
                on_event,
                ExecutionEvent(
                    type=ExecutionEventType.NODE_ERROR,
                    execution_id=context.execution_id,
                    timestamp=datetime.now(),
                    node_name=job.node_name,
                    error=error,
                ),
            )
            return True

        node = self._registry.get(node_def.type)
        input_count = getattr(node, "input_count", 1)

        # Handle multi-input nodes (like Merge)
        if input_count > 1 or input_count == float("inf"):
            handled = self._handle_multi_input_node(
                context,
                node_def,
                job.input_data,
                job.source_node,
                job.source_output,
                queue,
                job.run_index,
            )
            if not handled:
                return False  # Waiting for more inputs

        # Check for pinned data
        if node_def.pinned_data:
            context.node_states[job.node_name] = node_def.pinned_data
            self._queue_next_nodes(
                context,
                node_def,
                NodeExecutionResult(outputs={"main": node_def.pinned_data}),
                queue,
                node_map,
                job.run_index,
            )
            return False

        # Resolve expressions in parameters
        resolved_node_def = self._resolve_node_parameters(context, node_def, job.input_data)

        # Execute node with retry and error handling
        result: NodeExecutionResult | None = None
        max_retries = node_def.retry_on_fail
        retry_delay = node_def.retry_delay
        last_error: Exception | None = None

        for attempt in range(max_retries + 1):
            try:
                result = await node.execute(context, resolved_node_def, job.input_data)
                last_error = None
                break  # Success, exit retry loop
            except Exception as e:
                last_error = e
                if attempt < max_retries:
                    await asyncio.sleep(retry_delay / 1000)
                    continue

        # Handle final error after all retries exhausted
        if last_error or not result:
            error_msg = str(last_error) if last_error else "Unknown execution error"
            retry_info = f" (after {max_retries + 1} attempts)" if max_retries > 0 else ""
            context.errors.append(
                ExecutionError(
                    node_name=job.node_name,
                    error=f"{error_msg}{retry_info}",
                    timestamp=datetime.now(),
                )
            )

            self._emit_event(
                on_event,
                ExecutionEvent(
                    type=ExecutionEventType.NODE_ERROR,
                    execution_id=context.execution_id,
                    timestamp=datetime.now(),
                    node_name=job.node_name,
                    node_type=node_def.type,
                    error=error_msg,
                ),
            )

            # Check continueOnFail
            if node_def.continue_on_fail:
                result = NodeExecutionResult(
                    outputs={"main": [NodeData(json={"error": error_msg, "_errorNode": job.node_name})]}
                )
            else:
                # Propagate NO_OUTPUT to downstream nodes
                self._propagate_no_output(context, node_def, queue, node_map, job.run_index)
                return True

        # Update run count for loop support
        current_count = context.node_run_counts.get(job.node_name, 0)
        context.node_run_counts[job.node_name] = current_count + 1

        # Store node output (main output for state)
        main_output = result.outputs.get("main") or next(iter(result.outputs.values()), None)
        if main_output:
            context.node_states[job.node_name] = main_output

        # Queue next nodes based on outputs
        self._queue_next_nodes(context, node_def, result, queue, node_map, job.run_index)
        return False

    def _handle_multi_input_node(
        self,
        context: ExecutionContext,
        node_def: NodeDefinition,
        input_data: list[NodeData],
        source_node: str | None,
        source_output: str,
        queue: list[ExecutionJob],
        run_index: int,
    ) -> bool:
        """
        Handle nodes that expect multiple inputs (like Merge).

        Returns True if ready to execute, False if still waiting.
        """
        node_key = f"{node_def.name}:{run_index}"

        if node_key not in context.pending_inputs:
            context.pending_inputs[node_key] = {}

        pending = context.pending_inputs[node_key]
        input_key = f"{source_node}:{source_output}" if source_node else "initial"

        pending[input_key] = input_data

        # Get unique connection keys
        expected_connections = [
            f"{c.source_node}:{c.source_output}"
            for c in context.workflow.connections
            if c.target_node == node_def.name
        ]

        unique_expected_inputs = len(set(expected_connections))

        # Check if we have all inputs (including NO_OUTPUT signals)
        return len(pending) >= unique_expected_inputs

    def _queue_next_nodes(
        self,
        context: ExecutionContext,
        node_def: NodeDefinition,
        result: NodeExecutionResult,
        queue: list[ExecutionJob],
        node_map: dict[str, NodeDefinition],
        run_index: int,
    ) -> None:
        """Queue next nodes based on node outputs."""
        for output_name, output_data in result.outputs.items():
            # Find connections from this output
            connections = [
                c
                for c in context.workflow.connections
                if c.source_node == node_def.name and c.source_output == output_name
            ]

            for conn in connections:
                target_def = node_map.get(conn.target_node)
                if not target_def:
                    continue

                # Determine if this is a loop (going back to earlier node)
                is_loop = output_name == "loop"
                next_run_index = run_index + 1 if is_loop else run_index

                if output_data is None:
                    # NO_OUTPUT signal - only propagate to multi-input nodes (Merge)
                    target_node = self._registry.get(target_def.type)
                    target_input_count = getattr(target_node, "input_count", 1)
                    if target_input_count > 1 or target_input_count == float("inf"):
                        # Send signal to multi-input node so it knows this branch is dead
                        node_key = f"{conn.target_node}:{next_run_index}"
                        if node_key not in context.pending_inputs:
                            context.pending_inputs[node_key] = {}
                        context.pending_inputs[node_key][f"{node_def.name}:{output_name}"] = []
                    # Don't queue execution for single-input nodes when output is null
                elif output_data:
                    queue.append(
                        ExecutionJob(
                            node_name=conn.target_node,
                            input_data=output_data,
                            source_node=node_def.name,
                            source_output=output_name,
                            run_index=next_run_index,
                        )
                    )

    def _propagate_no_output(
        self,
        context: ExecutionContext,
        node_def: NodeDefinition,
        queue: list[ExecutionJob],
        node_map: dict[str, NodeDefinition],
        run_index: int,
    ) -> None:
        """Propagate NO_OUTPUT signal to all downstream nodes."""
        connections = [c for c in context.workflow.connections if c.source_node == node_def.name]

        for conn in connections:
            target_def = node_map.get(conn.target_node)
            if not target_def:
                continue

            target_node = self._registry.get(target_def.type)
            target_input_count = getattr(target_node, "input_count", 1)

            # If target is multi-input, send NO_OUTPUT signal
            if target_input_count > 1 or target_input_count == float("inf"):
                node_key = f"{conn.target_node}:{run_index}"
                if node_key not in context.pending_inputs:
                    context.pending_inputs[node_key] = {}
                context.pending_inputs[node_key][f"{node_def.name}:{conn.source_output}"] = NO_OUTPUT_SIGNAL

    def _resolve_node_parameters(
        self,
        context: ExecutionContext,
        node_def: NodeDefinition,
        input_data: list[NodeData],
    ) -> NodeDefinition:
        """Resolve expressions in node parameters."""
        expr_context = ExpressionEngine.create_context(
            input_data,
            context.node_states,
            context.execution_id,
            0,
        )

        resolved_params = expression_engine.resolve(node_def.parameters, expr_context)

        return NodeDefinition(
            name=node_def.name,
            type=node_def.type,
            parameters=resolved_params,
            position=node_def.position,
            pinned_data=node_def.pinned_data,
            retry_on_fail=node_def.retry_on_fail,
            retry_delay=node_def.retry_delay,
            continue_on_fail=node_def.continue_on_fail,
        )

    def _create_context(
        self, workflow: Workflow, mode: Literal["manual", "webhook", "cron"]
    ) -> ExecutionContext:
        """Create fresh execution context."""
        return ExecutionContext(
            workflow=workflow,
            execution_id=self._generate_id(),
            start_time=datetime.now(),
            mode=mode,
        )

    def find_start_node(self, workflow: Workflow) -> NodeDefinition | None:
        """Find start node in workflow."""
        # Priority: Webhook > Cron > Start > first node
        for node_type in ["Webhook", "Cron", "Start"]:
            node = next((n for n in workflow.nodes if n.type == node_type), None)
            if node:
                return node
        return workflow.nodes[0] if workflow.nodes else None

    def _generate_id(self) -> str:
        """Generate unique execution ID."""
        return f"exec_{int(datetime.now().timestamp() * 1000)}_{uuid.uuid4().hex[:7]}"
