import type { NodeDefinition } from '../schemas/workflow.js';
import type {
  ExecutionContext,
  NodeData,
  NodeExecutionResult,
} from '../engine/types.js';
import type { INodeTypeDescription } from '../engine/nodeSchema.js';
import { BaseNode } from './BaseNode.js';

/**
 * Gemini API types (minimal, avoiding full SDK dependency)
 */
interface GeminiContent {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

interface GeminiRequest {
  contents: GeminiContent[];
  systemInstruction?: { parts: Array<{ text: string }> };
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
  };
}

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{ text: string }>;
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
 * LLM Chat Node - Simple single-call LLM integration using Google Gemini
 *
 * This node makes a single request to the Gemini API and returns the response.
 * No tool calling, no conversation history - just prompt in, response out.
 */
export class LLMChatNode extends BaseNode {
  readonly type = 'LLMChat';
  readonly description = 'Make a simple LLM call using Google Gemini';

  static readonly nodeDescription: INodeTypeDescription = {
    name: 'LLMChat',
    displayName: 'LLM Chat',
    icon: 'fa:comment-dots',
    description: 'Make a simple LLM call using Google Gemini',
    group: ['ai'],
    inputs: [{ name: 'main', displayName: 'Input', type: 'main' }],
    outputs: [{ name: 'main', displayName: 'Output', type: 'main' }],

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
      const response = await this.callGemini(apiKey, {
        model,
        systemPrompt,
        userPrompt,
        temperature,
        maxTokens,
      });

      results.push({
        json: {
          ...item.json,
          response: response.text,
          model,
          usage: response.usage,
        },
      });
    }

    return this.output(results);
  }

  private async callGemini(
    apiKey: string,
    options: {
      model: string;
      systemPrompt: string;
      userPrompt: string;
      temperature: number;
      maxTokens: number;
    }
  ): Promise<{ text: string; usage: Record<string, number> }> {
    const { model, systemPrompt, userPrompt, temperature, maxTokens } = options;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const requestBody: GeminiRequest = {
      contents: [
        {
          role: 'user',
          parts: [{ text: userPrompt }],
        },
      ],
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
      },
    };

    // Add system instruction if provided
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

    const text = data.candidates[0].content.parts
      .map((p) => p.text)
      .join('');

    return {
      text,
      usage: {
        promptTokens: data.usageMetadata?.promptTokenCount || 0,
        completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: data.usageMetadata?.totalTokenCount || 0,
      },
    };
  }
}
