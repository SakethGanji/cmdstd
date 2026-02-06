# AI Agent Memory Types

## Overview

11 memory types total (2 existing + 9 new) organized into 4 categories:

| Category | Memory Types | Purpose |
|----------|-------------|---------|
| Basic | SimpleMemory, SQLiteMemory | Simple message storage |
| Windowing | BufferMemory, TokenBufferMemory, ConversationWindowMemory | Limit context size |
| Summarization | SummaryMemory, SummaryBufferMemory, ProgressiveSummaryMemory | Compress old context |
| Semantic/RAG | VectorMemory, EntityMemory, KnowledgeGraphMemory | Intelligent retrieval |

---

## Category 1: Windowing/Trimming

### 1. Buffer Memory

**Purpose:** Keep the last N messages (explicit version of SimpleMemory with storage options)

**Properties:**
| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `sessionId` | string | "default" | Session identifier |
| `maxMessages` | number | 20 | Number of messages to keep |
| `storage` | options | "memory" | "memory" (fast, volatile) or "sqlite" (persistent) |

**How it works:**
```
[msg1, msg2, msg3, msg4, msg5, msg6] → maxMessages=4 → [msg3, msg4, msg5, msg6]
```

**Use Cases:**
- Quick demos where you don't need long history
- Chatbots with short interaction patterns
- When you want explicit control over in-memory vs persistent storage

---

### 2. Token Buffer Memory

**Purpose:** Token-aware windowing - manages context by token budget, not message count

**Properties:**
| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `sessionId` | string | "default" | Session identifier |
| `maxTokens` | number | 4000 | Token budget |
| `tokenMethod` | options | "tiktoken" | "tiktoken" (accurate) or "chars" (fast estimate) |
| `tiktokenModel` | string | "gpt-4" | Model for encoding |

**How it works:**
```
Messages:     [500 tokens] [800 tokens] [1200 tokens] [600 tokens]
Budget: 2000  ────────────────────────────────────────►
Result:                    [800 tokens] [1200 tokens]  ✗ (600 would exceed)
                           ◄──────── kept ─────────►
```

**Use Cases:**
- When working with models that have strict context limits
- Precise context window management for production apps
- Avoiding "context too long" errors
- Cost optimization (fewer tokens = lower cost)

---

### 3. Conversation Window Memory

**Purpose:** Keep N complete conversation turns (user + assistant pairs)

**Properties:**
| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `sessionId` | string | "default" | Session identifier |
| `maxTurns` | number | 10 | Number of turns to keep |
| `includePartial` | boolean | true | Keep unpaired last message |

**How it works:**
```
Turn 1: User: "Hi"           → Assistant: "Hello!"
Turn 2: User: "How are you?" → Assistant: "I'm good!"
Turn 3: User: "Tell me..."   → Assistant: "Sure..."
Turn 4: User: "Thanks"       → (no response yet)

maxTurns=2 + includePartial=true:
[Turn 2 + Turn 3 + "Thanks" (partial)]
```

**Use Cases:**
- Maintaining conversation coherence (never split a turn mid-way)
- Customer support bots (keep complete Q&A pairs)
- Interview/survey bots where complete exchanges matter
- When you need logical conversation boundaries

---

## Category 2: Summarization

### 4. Summary Memory

**Purpose:** LLM summarizes old messages when threshold reached

**Properties:**
| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `sessionId` | string | "default" | Session identifier |
| `recentMessages` | number | 5 | Keep N recent unsummarized |
| `summaryThreshold` | number | 15 | Trigger summarization at N messages |
| `summaryModel` | string | "gemini-2.0-flash" | Model for summarization |

**How it works:**
```
Before (16 messages, threshold=15):
[msg1, msg2, msg3, ..., msg11, msg12, msg13, msg14, msg15, msg16]

After summarization (recentMessages=5):
[SUMMARY of msg1-msg11] + [msg12, msg13, msg14, msg15, msg16]
```

**Use Cases:**
- Long customer support sessions
- Multi-day conversations that need context preservation
- When you need both history awareness and context efficiency
- Agents that handle complex multi-step tasks

---

### 5. Summary Buffer Memory

**Purpose:** Hybrid - always maintains running summary + full recent messages

**Properties:**
| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `sessionId` | string | "default" | Session identifier |
| `recentMessages` | number | 10 | Full messages to keep |
| `summaryModel` | string | "gemini-2.0-flash" | Model for summarization |
| `summaryMaxTokens` | number | 500 | Max tokens for summary |

**How it works:**
```
┌─────────────────────────────────────────────────────────┐
│ [Running Summary]                                        │
│ "User discussed project timeline, decided on React,     │
│  mentioned budget constraints..."                        │
├─────────────────────────────────────────────────────────┤
│ [Full Recent Messages - last 10]                        │
│ User: "What about the database?"                        │
│ Assistant: "I recommend PostgreSQL..."                  │
│ ...                                                      │
└─────────────────────────────────────────────────────────┘
```

**Use Cases:**
- When you need both high-level context AND recent detail
- Project planning assistants
- Research assistants tracking evolving topics
- Better than pure summary when recent nuance matters

---

### 6. Progressive Summary Memory

**Purpose:** Rolling summary that updates every N messages - most aggressive compression

**Properties:**
| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `sessionId` | string | "default" | Session identifier |
| `summaryModel` | string | "gemini-2.0-flash" | Model for summarization |
| `maxSummaryTokens` | number | 1000 | Max summary length |
| `updateFrequency` | number | 2 | Update every N messages |

**How it works:**
```
Turn 1: Summary v1 = summarize(msg1, msg2)
Turn 2: Summary v2 = summarize(Summary v1 + msg3, msg4)
Turn 3: Summary v3 = summarize(Summary v2 + msg5, msg6)
...
Summary continuously evolves, always compressed
```

**Use Cases:**
- Very long conversations (hours/days)
- When context window is extremely limited
- Agents that run autonomously for extended periods
- When you can tolerate some detail loss for maximum compression

---

## Category 3: Semantic/RAG

### 7. Vector Memory

**Purpose:** Semantic search over conversation history using embeddings

**Properties:**
| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `sessionId` | string | "default" | Session identifier |
| `topK` | number | 5 | Relevant messages to retrieve |
| `embeddingProvider` | options | "openai" | "openai" or "gemini" |
| `embeddingModel` | string | "text-embedding-3-small" | Model ID |
| `alwaysIncludeRecent` | number | 2 | Always include N recent |
| `similarityThreshold` | number | 0.7 | Min similarity score (0-1) |

**How it works:**
```
User asks: "What did we discuss about the database?"

1. Embed the query → [0.12, -0.34, 0.56, ...]
2. Compare with all stored message embeddings
3. Return top-K most similar + recent messages

History: [msg about weather] [msg about database] [msg about lunch] [msg about DB schema]
         similarity: 0.2      similarity: 0.95     similarity: 0.1    similarity: 0.89

Result: [msg about database, msg about DB schema] + [last 2 recent messages]
```

**Use Cases:**
- "What did we discuss about X?" queries
- Long conversations where relevant context is scattered
- Research assistants recalling specific topics
- When chronological order doesn't match relevance

---

### 8. Entity Memory

**Purpose:** Extract and track entities (people, places, facts) mentioned in conversation

**Properties:**
| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `sessionId` | string | "default" | Session identifier |
| `extractionModel` | string | "gemini-2.0-flash" | Model for entity extraction |
| `entityTypes` | string | "person,place,organization,concept,fact" | Comma-separated types |
| `maxEntities` | number | 50 | Max entities to maintain |
| `recentMessages` | number | 5 | Recent messages to include |

**How it works:**
```
Conversation:
User: "I'm meeting John tomorrow about Project Alpha"
User: "John works at Acme Corp in the engineering team"
User: "The project deadline is next Friday"

Extracted Entities:
┌──────────────┬──────────────┬─────────────────────────────────────┐
│ Name         │ Type         │ Description                         │
├──────────────┼──────────────┼─────────────────────────────────────┤
│ John         │ person       │ Works at Acme Corp, engineering     │
│ Project Alpha│ concept      │ Deadline next Friday                │
│ Acme Corp    │ organization │ Where John works                    │
└──────────────┴──────────────┴─────────────────────────────────────┘

Output to LLM:
[Entity Summary] + [Recent 5 messages]
```

**Use Cases:**
- Personal assistant remembering people, places, projects
- CRM-like functionality - tracking mentioned contacts
- Meeting assistants tracking action items and people
- Research bots tracking concepts and facts

---

### 9. Knowledge Graph Memory

**Purpose:** Store entity relationships using Neo4j - builds a knowledge graph

**Properties:**
| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `sessionId` | string | "default" | Session identifier |
| `connectionString` | string | "bolt://localhost:7687" | Neo4j URI |
| `username` | string | "neo4j" | Neo4j username |
| `password` | string | "" | Neo4j password |
| `extractionModel` | string | "gemini-2.0-flash" | Model for relationship extraction |
| `maxRelationships` | number | 20 | Max relationships to return |
| `recentMessages` | number | 3 | Recent messages to include |

**How it works:**
```
Conversation:
"John manages the engineering team at Acme Corp"
"Project Alpha uses TensorFlow and is led by John"

Extracted & Stored in Neo4j:
    ┌───────┐         ┌─────────────┐
    │ John  │─manages→│ Engineering │
    └───┬───┘         └─────────────┘
        │
    leads↓         ┌────────────┐
        │          │ Acme Corp  │
    ┌───▼─────────┐└────────────┘
    │Project Alpha│
    └──────┬──────┘
           │uses
    ┌──────▼──────┐
    │ TensorFlow  │
    └─────────────┘

Output to LLM:
Knowledge Graph Context:
- John manages Engineering
- John leads Project Alpha
- Project Alpha uses TensorFlow

[Recent 3 messages]
```

**Use Cases:**
- Complex project management with many relationships
- Organizational knowledge bases
- Research with interconnected concepts
- When relationships between entities matter more than entities themselves
- Visualizable knowledge (can query Neo4j separately for graphs)

---

## Comparison Matrix

| Memory Type | Context Size | Compression | Semantic Understanding | Best For |
|-------------|--------------|-------------|----------------------|----------|
| Buffer | Fixed N msgs | None | No | Simple chatbots |
| Token Buffer | Fixed tokens | None | No | Token-limited models |
| Conv Window | Fixed turns | None | No | Q&A bots |
| Summary | Dynamic | High | Basic | Long sessions |
| Summary Buffer | Summary + N | Medium | Basic | Balanced needs |
| Progressive | Always small | Very High | Basic | Very long sessions |
| Vector | Top-K + recent | None | **Yes** | Topic recall |
| Entity | Entities + N | Medium | **Yes** | People/facts tracking |
| Knowledge Graph | Graph + N | Medium | **Yes** | Relationship tracking |

---

## Decision Tree: When to Use What?

```
Is your conversation short (<20 messages)?
├─ Yes → BufferMemory or SimpleMemory
└─ No → Do you need semantic recall?
         ├─ Yes → Do you track relationships?
         │        ├─ Yes → KnowledgeGraphMemory
         │        └─ No → Do you track entities?
         │                 ├─ Yes → EntityMemory
         │                 └─ No → VectorMemory
         └─ No → How aggressive should compression be?
                  ├─ Minimal → SummaryBufferMemory
                  ├─ Moderate → SummaryMemory
                  └─ Maximum → ProgressiveSummaryMemory
```

---

## External Dependencies Per Memory Type

| Memory Type | LLM API | Embedding API | Neo4j | SQLite | pip packages |
|-------------|---------|---------------|-------|--------|--------------|
| SimpleMemory | - | - | - | - | - |
| SQLiteMemory | - | - | - | Yes | - |
| BufferMemory | - | - | - | Optional | - |
| TokenBufferMemory | - | - | - | Yes | `tiktoken` |
| ConversationWindowMemory | - | - | - | Yes | - |
| SummaryMemory | **Yes** (summarization) | - | - | Yes | - |
| SummaryBufferMemory | **Yes** (summarization) | - | - | Yes | - |
| ProgressiveSummaryMemory | **Yes** (summarization) | - | - | Yes | - |
| VectorMemory | - | **Yes** (embeddings) | - | Yes | `numpy` |
| EntityMemory | **Yes** (extraction) | - | - | Yes | - |
| KnowledgeGraphMemory | **Yes** (extraction) | - | **Yes** | Yes | `neo4j` |

### Self-contained (no external services)

These work out of the box with zero configuration:

- **SimpleMemory** — in-memory only, no dependencies at all
- **SQLiteMemory** — local SQLite file only
- **BufferMemory** — in-memory or local SQLite
- **TokenBufferMemory** — local SQLite + `tiktoken` (bundled pip package)
- **ConversationWindowMemory** — local SQLite only

### Requires LLM API key

These call an LLM at runtime for summarization or entity extraction. Set `WORKFLOW_GEMINI_API_KEY` or use another configured model:

- **SummaryMemory** — calls LLM to summarize old messages when threshold is exceeded
- **SummaryBufferMemory** — calls LLM to summarize overflow messages into a running summary
- **ProgressiveSummaryMemory** — calls LLM every N messages to update the rolling summary
- **EntityMemory** — calls LLM on every message to extract entities (people, places, facts)
- **KnowledgeGraphMemory** — calls LLM on every message to extract entity relationships

### Requires embedding API key

- **VectorMemory** — calls an embedding API on every message store and every retrieval query
  - **OpenAI**: set `WORKFLOW_OPENAI_API_KEY`, model: `text-embedding-3-small`
  - **Gemini**: set `WORKFLOW_GEMINI_API_KEY`, model: `gemini-embedding-001`

### Requires Neo4j

- **KnowledgeGraphMemory** — requires a running Neo4j instance for graph storage
  - Quick start: `docker run -d -p 7474:7474 -p 7687:7687 -e NEO4J_AUTH=neo4j/yourpassword neo4j:5`
  - Configure via `connectionString`, `username`, `password` node properties

---

## pip packages

Added to `requirements.txt`:

```
tiktoken>=0.5.0     # Token counting (TokenBufferMemory)
numpy>=1.24.0       # Vector similarity (VectorMemory)
neo4j>=5.0.0        # Graph database driver (KnowledgeGraphMemory)
```

---

## Storage

All memory types use SQLite for persistence (`agent_memory.db` in project root), except:
- `SimpleMemory` — in-memory only (volatile)
- `BufferMemory` with `storage="memory"` — in-memory only
- `KnowledgeGraphMemory` — uses Neo4j for graph data, SQLite for messages

---

## Interface

All memory types implement the same interface:

```python
config = memory_node.get_config(node_definition)

# Returns:
{
    "type": "memory_type_name",
    "sessionId": str,
    "getHistory": callable,      # () -> list[{role, content}]
    "addMessage": callable,      # (role, content) -> None
    "clearHistory": callable,    # () -> None
    "getHistoryText": callable,  # () -> str
}
```

This allows the AI Agent node to use any memory type interchangeably.
