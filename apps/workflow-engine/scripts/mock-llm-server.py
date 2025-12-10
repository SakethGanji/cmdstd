"""
Mock LLM Proxy Server for testing

This script creates a local server that mimics the LLM proxy endpoint.
By default it returns mock responses. Set GOOGLE_AI_API_KEY to use real Gemini.
If API fails, returns a dummy response indicating the failure.

Usage:
  python scripts/mock-llm-server.py                    # Mock responses
  GOOGLE_AI_API_KEY=your-key python scripts/mock-llm-server.py  # Real Gemini

Then test with:
  curl -X POST http://localhost:8000/run_llm \
    -H 'Content-Type: application/json' \
    -d '{"system_prompt": "You are helpful", "user_prompt": "Hello", "temperature": 0.7, "max_output_tokens": 100}'
"""

import os
import json
from http.server import HTTPServer, BaseHTTPRequestHandler
import urllib.request
import urllib.error

PORT = 8000
GEMINI_MODEL = os.environ.get('GEMINI_MODEL', 'gemini-2.0-flash-lite')
GOOGLE_AI_API_KEY = os.environ.get('GOOGLE_AI_API_KEY')
USE_MOCK = not GOOGLE_AI_API_KEY


def mock_response(req: dict) -> dict:
    user_prompt = req.get('user_prompt', '')
    system_prompt = req.get('system_prompt', '')
    temperature = req.get('temperature', 0.7)
    max_tokens = req.get('max_output_tokens', 100)

    mock_text = f"""Mock response to: "{user_prompt[:50]}..."

This is a mock response from the test server. The LLM proxy is working correctly!

System context was: {(system_prompt[:30] + '...') if system_prompt else '(none)'}
Temperature: {temperature}, Max tokens: {max_tokens}"""

    return {
        'response': mock_text,
        'usage': {
            'prompt_tokens': len(user_prompt) // 4,
            'completion_tokens': len(mock_text) // 4,
            'total_tokens': (len(user_prompt) + len(mock_text)) // 4,
        }
    }


def api_failed_response(error_msg: str) -> dict:
    """Return a dummy response when API fails"""
    return {
        'response': f"[API FAILED - DUMMY RESPONSE] The API call failed with error: {error_msg}. This is a mock response for testing the flow.",
        'usage': {
            'prompt_tokens': 0,
            'completion_tokens': 0,
            'total_tokens': 0,
        }
    }


def call_gemini(req: dict) -> dict:
    if USE_MOCK:
        return mock_response(req)

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GOOGLE_AI_API_KEY}"

    request_body = {
        'contents': [
            {
                'role': 'user',
                'parts': [{'text': req.get('user_prompt', '')}]
            }
        ],
        'generationConfig': {
            'temperature': req.get('temperature', 0.7),
            'maxOutputTokens': req.get('max_output_tokens', 100)
        }
    }

    if req.get('system_prompt'):
        request_body['systemInstruction'] = {
            'parts': [{'text': req['system_prompt']}]
        }

    try:
        http_req = urllib.request.Request(
            url,
            data=json.dumps(request_body).encode('utf-8'),
            headers={'Content-Type': 'application/json'},
            method='POST'
        )

        with urllib.request.urlopen(http_req, timeout=30) as response:
            data = json.loads(response.read().decode('utf-8'))

        if not data.get('candidates') or len(data['candidates']) == 0:
            return api_failed_response('No response from Gemini API')

        text = ''.join(
            p.get('text', '') for p in data['candidates'][0]['content']['parts']
        )

        return {
            'response': text,
            'usage': {
                'prompt_tokens': data.get('usageMetadata', {}).get('promptTokenCount', 0),
                'completion_tokens': data.get('usageMetadata', {}).get('candidatesTokenCount', 0),
                'total_tokens': data.get('usageMetadata', {}).get('totalTokenCount', 0),
            }
        }

    except urllib.error.HTTPError as e:
        error_msg = f"Gemini API error ({e.code}): {e.read().decode('utf-8')}"
        print(f"API Error: {error_msg}")
        return api_failed_response(error_msg)
    except urllib.error.URLError as e:
        error_msg = f"Network error: {e.reason}"
        print(f"API Error: {error_msg}")
        return api_failed_response(error_msg)
    except Exception as e:
        error_msg = str(e)
        print(f"API Error: {error_msg}")
        return api_failed_response(error_msg)


class LLMHandler(BaseHTTPRequestHandler):
    def _set_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Accept')

    def do_OPTIONS(self):
        self.send_response(204)
        self._set_cors_headers()
        self.end_headers()

    def do_POST(self):
        if self.path == '/run_llm':
            try:
                content_length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(content_length).decode('utf-8')
                llm_request = json.loads(body)

                print(f"Received request: system_prompt={llm_request.get('system_prompt', '')[:50]}..., "
                      f"user_prompt={llm_request.get('user_prompt', '')[:50]}..., "
                      f"temperature={llm_request.get('temperature')}, "
                      f"max_output_tokens={llm_request.get('max_output_tokens')}")

                result = call_gemini(llm_request)

                print(f"Response: {result['response'][:100]}...")

                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self._set_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps(result).encode('utf-8'))

            except Exception as e:
                print(f"Error: {e}")
                self.send_response(200)  # Still return 200 with dummy response
                self.send_header('Content-Type', 'application/json')
                self._set_cors_headers()
                self.end_headers()
                result = api_failed_response(str(e))
                self.wfile.write(json.dumps(result).encode('utf-8'))
        else:
            self.send_response(404)
            self.send_header('Content-Type', 'application/json')
            self._set_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({'error': 'Not found'}).encode('utf-8'))

    def log_message(self, format, *args):
        # Suppress default logging
        pass


def main():
    server = HTTPServer(('', PORT), LLMHandler)
    print(f"Mock LLM Proxy Server running at http://localhost:{PORT}")
    print(f"Mode: {'MOCK (no API key)' if USE_MOCK else 'REAL (using Gemini API)'}")
    print(f"Endpoint: POST http://localhost:{PORT}/run_llm")
    print()
    print("Test with:")
    print(f"  curl -X POST http://localhost:{PORT}/run_llm \\")
    print("    -H 'Content-Type: application/json' \\")
    print('    -d \'{"system_prompt": "You are helpful", "user_prompt": "Say hello", "temperature": 0.7, "max_output_tokens": 100}\'')
    print()
    print("Note: If API fails, server returns a dummy response for flow testing.")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
        server.shutdown()


if __name__ == '__main__':
    main()
