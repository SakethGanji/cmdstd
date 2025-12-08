import type { NodeDefinition } from '../schemas/workflow.js';
import type {
  ExecutionContext,
  NodeData,
  NodeExecutionResult,
} from '../engine/types.js';
import type { INodeTypeDescription } from '../engine/nodeSchema.js';
import { BaseNode } from './BaseNode.js';

/**
 * LLM Proxy API types
 */
interface LLMProxyRequest {
  system_prompt: string;
  user_prompt: string;
  temperature: number;
  max_output_tokens: number;
}

interface LLMProxyResponse {
  response: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

/**
 * LLM Chat Node - Simple single-call LLM integration via proxy service
 *
 * This node makes a single request to the LLM proxy and returns the response.
 * No tool calling, no conversation history - just prompt in, response out.
 */
export class LLMChatNode extends BaseNode {
  readonly type = 'LLMChat';
  readonly description = 'Make a simple LLM call via proxy service';

  static readonly nodeDescription: INodeTypeDescription = {
    name: 'LLMChat',
    displayName: 'LLM Chat',
    icon: 'fa:comment-dots',
    description: 'Make a simple LLM call via proxy service',
    group: ['ai'],
    inputs: [{ name: 'main', displayName: 'Input', type: 'main' }],
    outputs: [
      {
        name: 'main',
        displayName: 'Output',
        type: 'main',
        schema: {
          type: 'object',
          properties: {
            response: { type: 'string', description: 'LLM response text' },
            usage: {
              type: 'object',
              description: 'Token usage statistics',
              properties: {
                promptTokens: { type: 'number', description: 'Tokens in prompt' },
                completionTokens: { type: 'number', description: 'Tokens in completion' },
                totalTokens: { type: 'number', description: 'Total tokens used' },
              },
            },
          },
        },
      },
    ],

    properties: [
      {
        displayName: 'LLM Proxy URL',
        name: 'proxyUrl',
        type: 'string',
        default: 'http://localhost:8000/run_llm',
        required: true,
        description: 'URL of the LLM proxy service',
      },
      {
        displayName: 'System Prompt',
        name: 'systemPrompt',
        type: 'string',
        default: '',
        description:
          'Instructions for how the AI should behave. Supports expressions: {{ $json.context }}',
        typeOptions: { rows: 4 },
      },
      {
        displayName: 'User Prompt',
        name: 'userPrompt',
        type: 'string',
        default: '',
        required: true,
        description:
          'The message to send to the AI. Supports expressions: {{ $json.question }}',
        typeOptions: { rows: 6 },
      },
      {
        displayName: 'Temperature',
        name: 'temperature',
        type: 'number',
        default: 0.7,
        description:
          'Controls randomness (0 = deterministic, 1 = creative). Range: 0-1',
        typeOptions: { minValue: 0, maxValue: 1, step: 0.1 },
      },
      {
        displayName: 'Max Tokens',
        name: 'maxTokens',
        type: 'number',
        default: 1024,
        description: 'Maximum number of tokens in the response',
        typeOptions: { minValue: 1, maxValue: 8192 },
      },
    ],
  };

  async execute(
    _context: ExecutionContext,
    nodeDefinition: NodeDefinition,
    inputData: NodeData[]
  ): Promise<NodeExecutionResult> {
    const proxyUrl = this.getParameter<string>(
      nodeDefinition,
      'proxyUrl',
      'http://localhost:8000/run_llm'
    );
    const systemPrompt = this.getParameter<string>(
      nodeDefinition,
      'systemPrompt',
      ''
    );
    const userPrompt = this.getParameter<string>(nodeDefinition, 'userPrompt');
    const temperature = this.getParameter<number>(
      nodeDefinition,
      'temperature',
      0.7
    );
    const maxTokens = this.getParameter<number>(
      nodeDefinition,
      'maxTokens',
      1024
    );

    const results: NodeData[] = [];

    // Process each input item
    for (const item of inputData.length > 0 ? inputData : [{ json: {} }]) {
      const response = await this.callLLMProxy(proxyUrl, {
        systemPrompt,
        userPrompt,
        temperature,
        maxTokens,
      });

      results.push({
        json: {
          ...item.json,
          response: response.text,
          usage: response.usage,
        },
      });
    }

    return this.output(results);
  }

  private async callLLMProxy(
    proxyUrl: string,
    options: {
      systemPrompt: string;
      userPrompt: string;
      temperature: number;
      maxTokens: number;
    }
  ): Promise<{ text: string; usage: Record<string, number> }> {
    const { systemPrompt, userPrompt, temperature, maxTokens } = options;

    const requestBody: LLMProxyRequest = {
      system_prompt: systemPrompt,
      user_prompt: userPrompt,
      temperature,
      max_output_tokens: maxTokens,
    };

    const response = await fetch(proxyUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`LLM Proxy error (${response.status}): ${error}`);
    }

    const data = (await response.json()) as LLMProxyResponse;

    if (!data.response) {
      throw new Error('No response from LLM Proxy');
    }

    return {
      text: data.response,
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
      },
    };
  }
}
