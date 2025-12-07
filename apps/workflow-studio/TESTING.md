# Workflow Studio Testing Guide

This document outlines test scenarios for validating the workflow execution functionality.

## Prerequisites

1. Start the backend server:
   ```bash
   cd apps/workflow-engine
   npm run dev
   ```
   Backend runs on `http://localhost:3000`

2. Start the frontend:
   ```bash
   cd apps/workflow-studio
   npm run dev
   ```
   Frontend runs on `http://localhost:5173`

---

## Test Scenarios

### 1. Basic Trigger Tests

#### 1.1 Manual Trigger Only
- **Setup**: Add a "Manual Trigger" (Start) node
- **Expected**:
  - Click "Test Workflow" → Success toast appears
  - Green dot on the node
  - Logs panel shows "Success in Xms"
  - Click node in logs → Output shows `{}`

#### 1.2 Webhook Trigger Only
- **Setup**: Add a "Webhook" node
- **Expected**:
  - Workflow saves with webhook path
  - Can trigger via: `curl -X POST http://localhost:3000/webhook/{path}`

#### 1.3 Cron Trigger Only
- **Setup**: Add a "Cron" node with expression (e.g., `*/5 * * * *`)
- **Expected**:
  - Workflow activates when "Active" toggle is on
  - Executes on schedule (test with short interval)

---

### 2. Data Transformation Tests

#### 2.1 Manual Trigger → Set Node
- **Setup**:
  1. Manual Trigger
  2. Set node with: `name = "John"`, `age = 30`
- **Expected**:
  - Output: `[{ "name": "John", "age": 30 }]`

#### 2.2 Manual Trigger → Code Node
- **Setup**:
  1. Manual Trigger
  2. Code node with:
     ```javascript
     return items.map(item => ({
       json: {
         ...item.json,
         processed: true,
         timestamp: Date.now()
       }
     }));
     ```
- **Expected**:
  - Output includes `processed: true` and `timestamp`

#### 2.3 Set Node → Code Node Chain
- **Setup**:
  1. Manual Trigger
  2. Set node: `value = 10`
  3. Code node: `return [{ json: { doubled: $input.first().json.value * 2 } }]`
- **Expected**:
  - Final output: `{ "doubled": 20 }`

---

### 3. HTTP Request Tests

#### 3.1 Simple GET Request
- **Setup**:
  1. Manual Trigger
  2. HTTP Request node:
     - Method: GET
     - URL: `https://jsonplaceholder.typicode.com/posts/1`
- **Expected**:
  - Output: `{ statusCode: 200, body: { userId: 1, id: 1, title: "...", body: "..." } }`

#### 3.2 POST Request with Body
- **Setup**:
  1. Manual Trigger
  2. HTTP Request node:
     - Method: POST
     - URL: `https://jsonplaceholder.typicode.com/posts`
     - Body: `{ "title": "Test", "body": "Hello", "userId": 1 }`
- **Expected**:
  - Output: `{ statusCode: 201, body: { id: 101, ... } }`

#### 3.3 HTTP Request with Custom Headers
- **Setup**:
  1. Manual Trigger
  2. HTTP Request node:
     - Method: GET
     - URL: `https://httpbin.org/headers`
     - Headers: `X-Custom-Header: TestValue`
- **Expected**:
  - Response body contains `X-Custom-Header: TestValue`

#### 3.4 Chained HTTP Requests
- **Setup**:
  1. Manual Trigger
  2. HTTP Request (GET users): `https://jsonplaceholder.typicode.com/users/1`
  3. Set node: Extract user ID from previous response
  4. HTTP Request (GET posts): `https://jsonplaceholder.typicode.com/posts?userId=1`
- **Expected**:
  - Final output contains posts for user 1

---

### 4. Conditional Logic Tests

#### 4.1 If Node - True Branch
- **Setup**:
  1. Manual Trigger
  2. Set node: `score = 85`
  3. If node: `{{ $json.score }} > 70`
  4. True branch → Set node: `result = "Pass"`
  5. False branch → Set node: `result = "Fail"`
- **Expected**:
  - Only "Pass" node executes
  - Output: `{ "result": "Pass" }`

#### 4.2 If Node - False Branch
- **Setup**: Same as above but `score = 50`
- **Expected**:
  - Only "Fail" node executes
  - Output: `{ "result": "Fail" }`

#### 4.3 Switch Node
- **Setup**:
  1. Manual Trigger
  2. Set node: `status = "pending"`
  3. Switch node on `{{ $json.status }}`:
     - Case "approved" → Set: `action = "process"`
     - Case "pending" → Set: `action = "review"`
     - Case "rejected" → Set: `action = "archive"`
     - Default → Set: `action = "unknown"`
- **Expected**:
  - "review" case executes
  - Output: `{ "action": "review" }`

---

### 5. Merge Node Tests

#### 5.1 Merge - Append Mode
- **Setup**:
  1. Manual Trigger splits to:
     - Branch A: Set node `source = "A"`
     - Branch B: Set node `source = "B"`
  2. Both connect to Merge node (mode: append)
- **Expected**:
  - Output: `[{ "source": "A" }, { "source": "B" }]`

#### 5.2 Merge - Combine Mode
- **Setup**:
  1. Manual Trigger splits to:
     - Branch A: Set node `name = "John"`
     - Branch B: Set node `age = 30`
  2. Both connect to Merge node (mode: combine, by position)
- **Expected**:
  - Output: `[{ "name": "John", "age": 30 }]`

---

### 6. Loop Tests

#### 6.1 SplitInBatches Node
- **Setup**:
  1. Manual Trigger
  2. Code node: Returns 10 items `[{id:1}, {id:2}, ..., {id:10}]`
  3. SplitInBatches (batch size: 3)
  4. Code node: Process batch
  5. Loop output back to SplitInBatches
- **Expected**:
  - Processes 4 batches (3+3+3+1)
  - All 10 items processed

---

### 7. Error Handling Tests

#### 7.1 Node Failure - Stop Workflow
- **Setup**:
  1. Manual Trigger
  2. HTTP Request to invalid URL: `https://invalid-url-12345.com`
  3. Set node after
- **Expected**:
  - HTTP Request shows red error dot
  - Set node does NOT execute
  - Error toast appears
  - Logs show error details

#### 7.2 Node Failure - Continue on Fail
- **Setup**:
  1. Manual Trigger
  2. HTTP Request to invalid URL (enable "Continue on Fail")
  3. Set node: `status = "completed"`
- **Expected**:
  - HTTP Request shows error but workflow continues
  - Set node executes
  - Output: `{ "status": "completed" }`

#### 7.3 Retry on Fail
- **Setup**:
  1. Manual Trigger
  2. HTTP Request with retry settings:
     - Retry on Fail: 2
     - Retry Delay: 1000ms
- **Expected**:
  - Node attempts 3 times total before failing
  - Error message shows "(after 3 attempts)"

---

### 8. Expression Tests

#### 8.1 JSON Path Expressions
- **Setup**:
  1. Manual Trigger
  2. Set node: `user = { "name": "John", "address": { "city": "NYC" } }`
  3. Set node: `city = {{ $json.user.address.city }}`
- **Expected**:
  - Output: `{ "city": "NYC" }`

#### 8.2 Previous Node Reference
- **Setup**:
  1. Manual Trigger
  2. Set node (name: "UserData"): `id = 123`
  3. Set node: `userId = {{ $node["UserData"].json.id }}`
- **Expected**:
  - Output: `{ "userId": 123 }`

#### 8.3 Built-in Variables
- **Setup**:
  1. Manual Trigger
  2. Set node: `executionId = {{ $executionId }}`
- **Expected**:
  - Output contains execution ID like `exec_1234567890_abc123`

---

### 9. Pinned Data Tests

#### 9.1 Pin Output Data
- **Setup**:
  1. Run any workflow with output
  2. Open node details (double-click)
  3. Click "Pin" button on output
- **Expected**:
  - Pin icon turns amber
  - "This output data is pinned" banner appears
  - Re-running workflow uses pinned data instead of executing

#### 9.2 Unpin Data
- **Setup**: Unpin previously pinned data
- **Expected**:
  - Node executes normally on next run
  - Fresh data appears in output

---

### 10. Save/Load Tests

#### 10.1 Save New Workflow
- **Setup**:
  1. Create workflow with multiple nodes
  2. Click "Save" button
- **Expected**:
  - Success toast: "Workflow created"
  - Workflow gets an ID

#### 10.2 Update Existing Workflow
- **Setup**:
  1. Modify a saved workflow
  2. Click "Save"
- **Expected**:
  - Success toast: "Workflow saved"
  - Changes persist on reload

#### 10.3 Export Workflow
- **Setup**: Click "Export" in navbar menu
- **Expected**:
  - JSON file downloads
  - Contains nodes, edges, and workflow metadata

---

### 11. UI/UX Tests

#### 11.1 Execution Logs Panel
- **Setup**: Run any workflow
- **Expected**:
  - Collapsed pill shows status (Success/Failed/Running)
  - Click to expand
  - Left panel lists all executed nodes
  - Click node to see output in right panel
  - "Clear execution" resets all data

#### 11.2 Node Status Indicators
- **Expected during execution**:
  - Amber pulsing dot = Running
  - Green dot = Success
  - Red dot = Error
  - Node background color changes to match status

#### 11.3 Toast Notifications
- **Expected**:
  - Success: Green toast with description
  - Error: Red toast with error message
  - Toasts auto-dismiss after ~5 seconds

---

## Quick Smoke Test Checklist

Run these 5 tests for a quick validation:

- [ ] Manual Trigger only → Green success
- [ ] Manual Trigger → HTTP GET → Returns data
- [ ] Manual Trigger → Set → If (true branch) → Correct output
- [ ] Invalid HTTP URL → Red error, workflow stops
- [ ] Save workflow → Reload page → Load workflow → Data persists

---

## Known Limitations

1. **No persistent storage**: Workflows are stored in memory; restart clears all data
2. **No real-time updates**: Must refresh to see external changes
3. **No authentication**: All workflows are accessible
4. **Expression errors**: Invalid expressions may cause silent failures

---

## Reporting Issues

If you find bugs, please note:
1. Steps to reproduce
2. Expected behavior
3. Actual behavior
4. Browser console errors (F12 → Console)
5. Network errors (F12 → Network tab)
