import asyncio
import time
import sys
import os

# Add src to path
sys.path.append(os.getcwd())

from src.engine.workflow_runner import WorkflowRunner
from src.engine.types import Workflow, NodeDefinition, Connection
from src.engine.node_registry import register_all_nodes

async def verify():
    print("Registering nodes...")
    register_all_nodes()
    
    runner = WorkflowRunner()
    
    # Create workflow with parallel wait nodes
    # Start -> Wait1 (2s)
    # Start -> Wait2 (2s)
    
    workflow = Workflow(
        name="Parallel Test",
        nodes=[
            NodeDefinition(name="Start", type="Start"),
            NodeDefinition(
                name="Wait1", 
                type="Wait", 
                parameters={"unit": "seconds", "duration": 2}
            ),
             NodeDefinition(
                name="Wait2", 
                type="Wait", 
                parameters={"unit": "seconds", "duration": 2}
            ),
        ],
        connections=[
            Connection(source_node="Start", target_node="Wait1"),
            Connection(source_node="Start", target_node="Wait2"),
        ]
    )
    
    print("Starting workflow execution...")
    start_time = time.time()
    
    try:
        context = await runner.run(workflow, start_node_name="Start")
        
        end_time = time.time()
        duration = end_time - start_time
        
        print(f"Execution took {duration:.2f} seconds")
        
        errors = context.errors
        if errors:
            print("Errors:", errors)
            
        # Verify duration
        if 2.0 <= duration < 2.5:
            print("SUCCESS: Parallel execution verified (took ~2s)")
        elif duration >= 4.0:
            print("FAILURE: Execution seems sequential (took >= 4s)")
        else:
            print(f"WARNING: Execution time unclear: {duration:.2f}s")
            
    except Exception as e:
        print(f"Execution failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(verify())
