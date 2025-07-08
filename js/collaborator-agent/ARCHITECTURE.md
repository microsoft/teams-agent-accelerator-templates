# Teams AI Bot Architecture - Optimized Storage & Function Calling

## Overview

This bot uses an optimized architecture with SQLite-based persistent storage, efficient message tracking, and function calling for all major actions.

## Key Features

### 1. **Efficient Message Tracking**
- **Own Message Array**: Instead of expensive filtering on `prompt.messages.values()`, we maintain our own `conversationMessages` Map for each conversation
- **Smart Storage**: Only stores relevant messages based on chat type:
  - **1:1 Chats**: Stores user + AI messages (conversational context)
  - **Group/Channel Chats**: Stores only user messages (reduces noise)
- **Performance**: No expensive filtering on every message send - dramatically improves performance at scale

### 2. **SQLite Dual-Table Schema**
- **`conversations` Table**: Fast Message[] array retrieval by conversation ID
- **`messages` Table**: Individual messages with UTC timestamps for advanced querying
- **Indexes**: Optimized with indexes on `conversation_id` and `timestamp`

### 3. **Function Calling Architecture**
All bot actions use Teams AI function calling instead of manual text parsing:

#### Available Functions:
- `get_recent_messages` - Retrieve recent messages with timestamps
- `get_messages_by_time_range` - Query messages within time ranges  
- `show_recent_messages` - Display formatted recent messages to users
- `clear_conversation_history` - Clear all conversation history
- `summarize_conversation` - Get conversation statistics
- `debug_database` - Debug function to inspect database contents

#### Function Registration:
Functions are registered using chained `.function()` calls after `new ChatPrompt()`:

```typescript
const prompt = new ChatPrompt({...})
  .function('get_recent_messages', description, schema, handler)
  .function('get_messages_by_time_range', description, schema, handler)
  // ... other functions
```

### 4. **Chat Type Detection**
The bot automatically detects conversation type and optimizes storage:

```typescript
private isOneOnOneChat(conversationKey: string): boolean {
  return conversationKey.includes('_8:') && !conversationKey.includes('meeting');
}
```

- **1:1 Chats**: Full conversational storage (user + AI messages)
- **Group Chats**: User messages only (reduces storage overhead)

### 5. **Message Flow**

```
User Message → addMessageToTracking() → LLM Processing → AI Response → addMessageToTracking() → saveConversation()
```

1. **User sends message** → Added to our tracking array
2. **LLM processes** → Uses function calling for actions
3. **AI responds** → Response added to our tracking array  
4. **Save to storage** → Filtered messages saved to SQLite

### 6. **Debug Capabilities**
- **Manual Command**: `msg.db` command for instant database inspection
- **Function Call**: `debug_database` function for programmatic access
- **Console Logging**: Detailed logging of message tracking and storage operations

## File Structure

```
src/
├── index.ts                    # Main app logic, message handler
├── agent/
│   ├── core.ts                # Prompt manager, function registration, message tracking
│   ├── manager.ts             # (optional additional managers)
│   └── router.ts              # (routing logic if needed)
├── storage/
│   └── storage.ts             # SQLite KV store, dual-table schema
├── capabilities/
│   └── summarize.ts           # Summarization capabilities
└── services/
    ├── llmService.ts          # LLM service abstractions
    └── teamsConversationService.ts
```

## Performance Benefits

### Before (Inefficient):
```typescript
// Expensive filtering on every save
const allMessages = Array.from(prompt.messages.values());
const filteredMessages = allMessages.filter(msg => 
  msg.role === 'user' || msg.role === 'model'
);
```

### After (Optimized):
```typescript
// Use our own tracking - no filtering needed
const messages = this.conversationMessages.get(conversationKey) || [];
const messagesToStore = isOneOnOne ? 
  messages.filter(msg => msg.role === 'user' || msg.role === 'model') :
  messages.filter(msg => msg.role === 'user');
```

## Usage Examples

### Function Calling:
```
User: "Show me recent messages from yesterday"
→ LLM calls get_messages_by_time_range with appropriate time range
→ Returns formatted message history
```

### Debug Access:
```
User: "msg.db"
→ Instant database contents display
```

### Storage Optimization:
```
1:1 Chat: 1000 messages → Stores ~1000 messages (user + AI)
Group Chat: 1000 messages → Stores ~500 messages (user only)
```

## Environment Variables

```env
AOAI_MODEL=gpt-4o
AOAI_API_KEY=your_api_key
AOAI_ENDPOINT=https://your-endpoint.openai.azure.com/
```

## Key Classes

- **`CorePromptManager`**: Main prompt and message management
- **`SqliteKVStore`**: Persistent storage with dual-table schema
- **`MessageRecord`**: Interface for timestamped message records

This architecture provides excellent performance, persistent storage, and powerful querying capabilities while maintaining clean separation of concerns.
