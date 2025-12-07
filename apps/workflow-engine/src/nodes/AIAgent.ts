import type { NodeDefinition } from '../schemas/workflow.js';
import type {
  ExecutionContext,
  NodeData,
  NodeExecutionResult,
} from '../engine/types.js';
import type { INodeTypeDescription } from '../engine/nodeSchema.js';
import { BaseNode } from './BaseNode.js';
import {
  getToolDeclarations,
  executeTool,
  listTools,
  type ToolDeclaration,
} from './ai/tools.js';

/**
 * Gemini API types for function calling
 */
interface GeminiTool {
  functionDeclarations: ToolDeclaration[];
}

interface GeminiContent {
  role: 'user' | 'model' | 'function';
  parts: Array<
    | { text: string }
    | { functionCall: { name: string; args: Record<string, unknown> } }
    | { functionResponse: { name: string; response: Record<string, unknown> } }
  >;
}

interface GeminiRequest {
  contents: GeminiContent[];
  tools?: GeminiTool[];
  systemInstruction?: { parts: Array<{ text: string }> };
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
  };
}

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<
        | { text?: string }
        | { functionCall?: { name: string; args: Record<string, unknown> } }
      >;
      role: string;
    };
    finishReason: string;
  }>;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

/**
 * AI Agent Node - Agentic LLM with tool calling using Google Gemini
 *
 * This node implements an agentic loop:
 * 1. Send prompt + tools to LLM
 * 2. If LLM requests a tool call, execute it
 * 3. Feed result back to LLM
 * 4. Repeat until LLM is done or max iterations reached
 *
 * Tools are loaded from the shared tools registry (src/nodes/ai/tools.ts)
 */
export class AIAgentNode extends BaseNode {
  readonly type = 'AIAgent';
  readonly description = 'AI Agent with tool calling capabilities using Gemini';

  static readonly nodeDescription: INodeTypeDescription = {
    name: 'AIAgent',
    displayName: 'AI Agent',
    icon: 'fa:robot',
    description: 'AI Agent with tool calling capabilities using Gemini',
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
            response: { type: 'string', description: 'Agent final response text' },
            toolCalls: {
              type: 'array',
              description: 'List of tool calls made by the agent',
              items: {
                type: 'object',
                properties: {
                  tool: { type: 'string', description: 'Tool name' },
                  args: { type: 'unknown', description: 'Tool arguments' },
                  result: { type: 'unknown', description: 'Tool result' },
                },
              },
            },
            iterations: { type: 'number', description: 'Number of agent loop iterations' },
            model: { type: 'string', description: 'Model used for generation' },
            usage: {
              type: 'object',
              description: 'Token usage statistics',
              properties: {
                promptTokens: { type: 'number', description: 'Total tokens in prompts' },
                completionTokens: { type: 'number', description: 'Total tokens in completions' },
                totalTokens: { type: 'number', description: 'Total tokens used' },
              },
            },
          },
        },
      },
    ],

    properties: [
      {
        displayName: 'API Key',
        name: 'apiKey',
        type: 'string',
        default: '',
        required: true,
        description:
          'Google AI API Key. Get yours at https://aistudio.google.com/app/apikey',
        typeOptions: { password: true },
      },
      {
        displayName: 'Model',
        name: 'model',
        type: 'options',
        default: 'gemini-2.5-flash',
        required: true,
        options: [
          {
            name: 'Gemini 2.5 Flash',
            value: 'gemini-2.5-flash',
            description: 'Fast and efficient, supports 1M tokens',
          },
          {
            name: 'Gemini 2.5 Pro',
            value: 'gemini-2.5-pro',
            description: 'Most capable, best for complex tasks',
          },
          {
            name: 'Gemini 2.0 Flash',
            value: 'gemini-2.0-flash',
            description: 'Fast and versatile multimodal model',
          },
        ],
      },
      {
        displayName: 'System Prompt',
        name: 'systemPrompt',
        type: 'string',
        default:
          'You are a helpful assistant. Use the available tools when needed to complete tasks.',
        description: 'Instructions for how the AI agent should behave',
        typeOptions: { rows: 4 },
      },
      {
        displayName: 'User Prompt',
        name: 'userPrompt',
        type: 'string',
        default: '',
        required: true,
        description:
          'The task for the agent to complete. Supports expressions: {{ $json.task }}',
        typeOptions: { rows: 6 },
      },
      {
        displayName: 'Tools',
        name: 'tools',
        type: 'json',
        default: '["http_request", "calculate", "get_current_time"]',
        description: `JSON array of tools to enable. Available: ${listTools().map((t) => `"${t}"`).join(', ')}`,
        typeOptions: { rows: 3 },
      },
      {
        displayName: 'Max Iterations',
        name: 'maxIterations',
        type: 'number',
        default: 10,
        description:
          'Maximum number of tool call iterations to prevent infinite loops',
        typeOptions: { minValue: 1, maxValue: 50 },
      },
      {
        displayName: 'Temperature',
        name: 'temperature',
        type: 'number',
        default: 0.7,
        description: 'Controls randomness (0 = deterministic, 1 = creative)',
        typeOptions: { minValue: 0, maxValue: 1, step: 0.1 },
      },
      {
        displayName: 'Max Tokens',
        name: 'maxTokens',
        type: 'number',
        default: 2048,
        description: 'Maximum number of tokens in each response',
        typeOptions: { minValue: 1, maxValue: 8192 },
      },
    ],
  };

  async execute(
    _context: ExecutionContext,
    nodeDefinition: NodeDefinition,
    inputData: NodeData[]
  ): Promise<NodeExecutionResult> {
    // Get API key from parameter, fallback to environment variable
    const apiKeyParam = this.getParameter<string>(nodeDefinition, 'apiKey', '');
    const apiKey = apiKeyParam || process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) {
      throw new Error(
        'API Key is required. Enter it in the node settings or set GOOGLE_AI_API_KEY environment variable.'
      );
    }

    const model = this.getParameter<string>(nodeDefinition, 'model');
    const systemPrompt = this.getParameter<string>(
      nodeDefinition,
      'systemPrompt',
      ''
    );
    const userPrompt = this.getParameter<string>(nodeDefinition, 'userPrompt');
    const toolsParam = this.getParameter<string | string[]>(
      nodeDefinition,
      'tools',
      '["http_request", "calculate", "get_current_time"]'
    );
    // Handle both JSON string and array formats
    const selectedTools: string[] =
      typeof toolsParam === 'string' ? JSON.parse(toolsParam) : toolsParam;
    const maxIterations = this.getParameter<number>(
      nodeDefinition,
      'maxIterations',
      10
    );
    const temperature = this.getParameter<number>(
      nodeDefinition,
      'temperature',
      0.7
    );
    const maxTokens = this.getParameter<number>(
      nodeDefinition,
      'maxTokens',
      2048
    );

    const results: NodeData[] = [];

    // Process each input item
    for (const item of inputData.length > 0 ? inputData : [{ json: {} }]) {
      const response = await this.runAgentLoop(apiKey, {
        model,
        systemPrompt,
        userPrompt,
        selectedTools,
        maxIterations,
        temperature,
        maxTokens,
        inputData: item.json,
      });

      results.push({
        json: {
          ...item.json,
          response: response.text,
          toolCalls: response.toolCalls,
          iterations: response.iterations,
          model,
          usage: response.usage,
        },
      });
    }

    return this.output(results);
  }

  private async runAgentLoop(
    apiKey: string,
    options: {
      model: string;
      systemPrompt: string;
      userPrompt: string;
      selectedTools: string[];
      maxIterations: number;
      temperature: number;
      maxTokens: number;
      inputData: Record<string, unknown>;
    }
  ): Promise<{
    text: string;
    toolCalls: Array<{ tool: string; args: unknown; result: unknown }>;
    iterations: number;
    usage: Record<string, number>;
  }> {
    const {
      model,
      systemPrompt,
      userPrompt,
      selectedTools,
      maxIterations,
      temperature,
      maxTokens,
      inputData,
    } = options;

    // Get tool declarations from the shared registry
    const toolDeclarations = getToolDeclarations(selectedTools);
    const tools: GeminiTool | undefined =
      toolDeclarations.length > 0
        ? { functionDeclarations: toolDeclarations }
        : undefined;

    // Initialize conversation
    const contents: GeminiContent[] = [
      {
        role: 'user',
        parts: [
          {
            text: `${userPrompt}\n\nContext data: ${JSON.stringify(inputData)}`,
          },
        ],
      },
    ];

    const toolCalls: Array<{ tool: string; args: unknown; result: unknown }> =
      [];
    let totalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    let iterations = 0;
    let finalText = '';

    // Agent loop
    while (iterations < maxIterations) {
      iterations++;

      const response = await this.callGemini(apiKey, {
        model,
        contents,
        tools,
        systemPrompt,
        temperature,
        maxTokens,
      });

      // Accumulate usage
      if (response.usage) {
        totalUsage.promptTokens += response.usage.promptTokens;
        totalUsage.completionTokens += response.usage.completionTokens;
        totalUsage.totalTokens += response.usage.totalTokens;
      }

      const candidate = response.candidates[0];
      const parts = candidate.content.parts;

      // Check for function calls
      const functionCalls = parts.filter(
        (
          p
        ): p is {
          functionCall: { name: string; args: Record<string, unknown> };
        } => 'functionCall' in p
      );

      if (functionCalls.length > 0) {
        // Add assistant response to conversation
        contents.push({
          role: 'model',
          parts: parts as GeminiContent['parts'],
        });

        // Execute each function call using shared tool executor
        const functionResponses: GeminiContent['parts'] = [];

        for (const fc of functionCalls) {
          const toolName = fc.functionCall.name;
          const toolArgs = fc.functionCall.args;

          const result = await executeTool(toolName, toolArgs);

          if (result.success) {
            toolCalls.push({ tool: toolName, args: toolArgs, result: result.result });
            functionResponses.push({
              functionResponse: {
                name: toolName,
                response: result.result as Record<string, unknown>,
              },
            });
          } else {
            toolCalls.push({
              tool: toolName,
              args: toolArgs,
              result: { error: result.error },
            });
            functionResponses.push({
              functionResponse: {
                name: toolName,
                response: { error: result.error },
              },
            });
          }
        }

        // Add function responses to conversation
        contents.push({
          role: 'function',
          parts: functionResponses,
        });

        // Continue the loop
        continue;
      }

      // No function calls - we have a final response
      const textParts = parts.filter(
        (p): p is { text: string } => 'text' in p && typeof p.text === 'string'
      );
      finalText = textParts.map((p) => p.text).join('');
      break;
    }

    return {
      text: finalText,
      toolCalls,
      iterations,
      usage: totalUsage,
    };
  }

  private async callGemini(
    apiKey: string,
    options: {
      model: string;
      contents: GeminiContent[];
      tools?: GeminiTool;
      systemPrompt: string;
      temperature: number;
      maxTokens: number;
    }
  ): Promise<GeminiResponse & { usage: Record<string, number> }> {
    const { model, contents, tools, systemPrompt, temperature, maxTokens } =
      options;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const requestBody: GeminiRequest = {
      contents,
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
      },
    };

    if (tools) {
      requestBody.tools = [tools];
    }

    if (systemPrompt) {
      requestBody.systemInstruction = {
        parts: [{ text: systemPrompt }],
      };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error (${response.status}): ${error}`);
    }

    const data = (await response.json()) as GeminiResponse;

    if (!data.candidates || data.candidates.length === 0) {
      throw new Error('No response from Gemini API');
    }

    return {
      ...data,
      usage: {
        promptTokens: data.usageMetadata?.promptTokenCount || 0,
        completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: data.usageMetadata?.totalTokenCount || 0,
      },
    };
  }
}
