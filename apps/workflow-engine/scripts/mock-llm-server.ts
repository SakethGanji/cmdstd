/**
 * Mock LLM Proxy Server for testing
 *
 * This script creates a local server that mimics the LLM proxy endpoint.
 * By default it returns mock responses. Set GOOGLE_AI_API_KEY to use real Gemini.
 *
 * Usage:
 *   npx tsx scripts/mock-llm-server.ts                    # Mock responses
 *   GOOGLE_AI_API_KEY=your-key npx tsx scripts/mock-llm-server.ts  # Real Gemini
 *
 * Then test with:
 *   curl -X POST http://localhost:8000/run_llm \
 *     -H 'Content-Type: application/json' \
 *     -d '{"system_prompt": "You are helpful", "user_prompt": "Hello", "temperature": 0.7, "max_output_tokens": 100}'
 */

import { createServer, IncomingMessage, ServerResponse } from 'http';

const PORT = 8000;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash-lite';
const USE_MOCK = !process.env.GOOGLE_AI_API_KEY;

interface LLMRequest {
  system_prompt: string;
  user_prompt: string;
  temperature: number;
  max_output_tokens: number;
}

interface LLMResponse {
  response: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

function mockResponse(req: LLMRequest): LLMResponse {
  const mockText = `Mock response to: "${req.user_prompt.substring(0, 50)}..."

This is a mock response from the test server. The LLM proxy is working correctly!

System context was: ${req.system_prompt ? req.system_prompt.substring(0, 30) + '...' : '(none)'}
Temperature: ${req.temperature}, Max tokens: ${req.max_output_tokens}`;

  return {
    response: mockText,
    usage: {
      prompt_tokens: Math.floor(req.user_prompt.length / 4),
      completion_tokens: Math.floor(mockText.length / 4),
      total_tokens: Math.floor((req.user_prompt.length + mockText.length) / 4),
    },
  };
}

async function callGemini(req: LLMRequest): Promise<LLMResponse> {
  if (USE_MOCK) {
    return mockResponse(req);
  }

  const apiKey = process.env.GOOGLE_AI_API_KEY!;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const requestBody: Record<string, unknown> = {
    contents: [
      {
        role: 'user',
        parts: [{ text: req.user_prompt }],
      },
    ],
    generationConfig: {
      temperature: req.temperature,
      maxOutputTokens: req.max_output_tokens,
    },
  };

  if (req.system_prompt) {
    requestBody.systemInstruction = {
      parts: [{ text: req.system_prompt }],
    };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${error}`);
  }

  const data = await response.json();

  if (!data.candidates || data.candidates.length === 0) {
    throw new Error('No response from Gemini API');
  }

  const text = data.candidates[0].content.parts
    .map((p: { text: string }) => p.text)
    .join('');

  return {
    response: text,
    usage: {
      prompt_tokens: data.usageMetadata?.promptTokenCount || 0,
      completion_tokens: data.usageMetadata?.candidatesTokenCount || 0,
      total_tokens: data.usageMetadata?.totalTokenCount || 0,
    },
  };
}

function parseBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/run_llm') {
    try {
      const body = await parseBody(req);
      const llmRequest: LLMRequest = JSON.parse(body);

      console.log('Received request:', {
        system_prompt: llmRequest.system_prompt?.substring(0, 50) + '...',
        user_prompt: llmRequest.user_prompt?.substring(0, 50) + '...',
        temperature: llmRequest.temperature,
        max_output_tokens: llmRequest.max_output_tokens,
      });

      const result = await callGemini(llmRequest);

      console.log('Response:', result.response.substring(0, 100) + '...');

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (error) {
      console.error('Error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: String(error) }));
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`Mock LLM Proxy Server running at http://localhost:${PORT}`);
  console.log(`Mode: ${USE_MOCK ? 'MOCK (no API key)' : 'REAL (using Gemini API)'}`);
  console.log(`Endpoint: POST http://localhost:${PORT}/run_llm`);
  console.log('');
  console.log('Test with:');
  console.log(`  curl -X POST http://localhost:${PORT}/run_llm \\`);
  console.log("    -H 'Content-Type: application/json' \\");
  console.log('    -d \'{"system_prompt": "You are helpful", "user_prompt": "Say hello", "temperature": 0.7, "max_output_tokens": 100}\'');
});
