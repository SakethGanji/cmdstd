/**
 * Graph traversal utilities for workflow nodes
 */

import type { Node, Edge } from 'reactflow';

export interface UpstreamNode {
  id: string;
  name: string;
  label: string;
  isImmediate: boolean; // true if directly connected to the target node
}

/**
 * Get all upstream nodes in topological order (execution order).
 * Traverses the graph backwards from the given node to find all nodes
 * that feed data into it, directly or indirectly.
 *
 * @param nodeId - The node to find upstream nodes for
 * @param nodes - All nodes in the workflow
 * @param edges - All edges in the workflow
 * @returns Array of upstream nodes in execution order (earliest first)
 */
export function getAllUpstreamNodes(
  nodeId: string,
  nodes: Node[],
  edges: Edge[]
): UpstreamNode[] {
  const result: UpstreamNode[] = [];
  const visited = new Set<string>();

  // Find the immediate source node (directly connected)
  const immediateSourceId = edges.find(
    (e) => e.target === nodeId && !e.data?.isSubnodeEdge
  )?.source;

  function traverse(currentId: string) {
    if (visited.has(currentId)) return;
    visited.add(currentId);

    // Find incoming edges to this node (exclude subnode edges)
    const incomingEdges = edges.filter(
      (e) => e.target === currentId && !e.data?.isSubnodeEdge
    );

    for (const edge of incomingEdges) {
      const sourceNode = nodes.find((n) => n.id === edge.source);

      // Only include workflow nodes (not subnodes, sticky notes, etc.)
      if (sourceNode && sourceNode.type === 'workflowNode') {
        // Recursively traverse upstream first (for topological order)
        traverse(sourceNode.id);

        // Add to result if not already added
        if (!result.find((n) => n.id === sourceNode.id)) {
          result.push({
            id: sourceNode.id,
            name: sourceNode.data.name || sourceNode.data.label,
            label: sourceNode.data.label,
            isImmediate: sourceNode.id === immediateSourceId,
          });
        }
      }
    }
  }

  traverse(nodeId);
  return result;
}

/**
 * Generate the expression base path for a node.
 * For the immediate upstream node, use $json.
 * For other nodes, use $node["NodeName"].json.
 *
 * @param nodeName - The name of the node
 * @param isImmediate - Whether this is the immediately connected node
 * @returns The base path for expressions (e.g., '$json' or '$node["ChatInput"].json')
 */
export function getExpressionBasePath(nodeName: string, isImmediate: boolean): string {
  if (isImmediate) {
    return '$json';
  }
  return `$node["${nodeName}"].json`;
}
