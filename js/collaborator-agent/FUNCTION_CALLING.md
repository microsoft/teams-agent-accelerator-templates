# Function Calling in Teams AI Bot

This Teams AI bot now supports function calling, allowing the AI model to automatically call functions to retrieve conversation data, manage history, and provide summaries.

## Available Functions

The bot has access to the following functions that the AI can call automatically:

### 1. `get_recent_messages`
- **Description**: Retrieve recent messages from the conversation history with timestamps
- **Parameters**: 
  - `limit` (optional): Number of recent messages to retrieve (default: 5, max: 20)
- **Usage**: The AI can call this when users ask about recent messages

### 2. `show_recent_messages`
- **Description**: Display recent messages in a formatted way for the user
- **Parameters**: 
  - `count` (optional): Number of recent messages to display (default: 5, max: 20)
- **Usage**: The AI can call this when users ask to see recent messages formatted for display

### 3. `get_messages_by_time_range`
- **Description**: Retrieve messages from a specific time range
- **Parameters**: 
  - `start_time` (optional): Start time in ISO format (e.g., 2024-01-01T00:00:00.000Z)
  - `end_time` (optional): End time in ISO format (e.g., 2024-01-01T23:59:59.999Z)
- **Usage**: The AI can call this when users ask about messages from specific time periods

### 4. `clear_conversation_history`
- **Description**: Clear all conversation history for this chat
- **Parameters**: None
- **Usage**: The AI can call this when users explicitly ask to clear or reset the conversation

### 5. `summarize_conversation`
- **Description**: Get a summary of the conversation with message counts and time span
- **Parameters**: None
- **Usage**: The AI can call this when users ask for conversation summaries or statistics

### 6. `debug_database` 
- **Description**: Debug function to print database contents for the current conversation
- **Parameters**: None
- **Usage**: Internal debugging - prints detailed database information to console and returns structured data
- **Manual Access**: Type `msg.db` to trigger this function directly

## Debug Command

### Manual Database Debug: `msg.db`
- **Trigger**: Type exactly `msg.db` in the chat
- **Response**: Returns detailed JSON with:
  - Database statistics (total conversations/messages)
  - Conversation table data (creation/update times, message count)
  - Individual message records with timestamps and previews
  - Full database structure for the current conversation
- **Console Output**: Detailed debug info is also printed to the server console

## How It Works

1. **Automatic Function Calling**: When you send a message to the bot, the AI model automatically determines if it needs to call any functions to answer your question.

2. **Natural Language Queries**: You can ask questions in natural language, such as:
   - "Show me the last 5 messages"
   - "Can you display recent messages?"
   - "What messages did we exchange yesterday?"
   - "Can you summarize our conversation?"
   - "Clear the chat history"
   - "Delete our conversation"

3. **Function Execution**: The AI calls the appropriate function(s) and uses the results to provide a comprehensive response.

## Example Interactions

- **User**: "Show me the recent messages"
  - **AI**: Calls `show_recent_messages` and displays formatted messages with timestamps

- **User**: "What did we discuss this morning?"
  - **AI**: Calls `get_messages_by_time_range` with appropriate time parameters

- **User**: "How many messages have we exchanged so far?"
  - **AI**: Calls `summarize_conversation` and provides statistics

- **User**: "Please clear our conversation history"
  - **AI**: Calls `clear_conversation_history` and confirms the action

- **User**: "Can you show me our chat history?"
  - **AI**: Calls `show_recent_messages` with an appropriate count

## Changes from Manual Commands

**REMOVED**: Manual text-based commands like:
- ❌ `CLEAR PREVIOUS HISTORY`
- ❌ `SHOW RECENT MESSAGES` 
- ❌ `SHOW ALL TIMESTAMPS`

**NEW**: Natural language function calling:
- ✅ "Clear the conversation"
- ✅ "Show recent messages"
- ✅ "Display our chat history"
- ✅ "What have we talked about?"

## Technical Implementation

- **Storage**: Uses SQLite database with improved timestamp handling:
  - `conversations`: Stores Message[] arrays for fast retrieval
  - `messages`: Stores individual messages with unique UTC timestamps for querying
  
- **Function Registration**: Functions are registered directly with ChatPrompt using `prompt.function()`

- **Smart Timestamps**: Each message gets its own timestamp when first saved, preventing duplicate timestamps

- **Response Format**: Functions return structured JSON that the AI interprets and presents naturally

## Benefits

1. **Natural Interaction**: Users can ask questions naturally without remembering specific commands
2. **Intelligent Context**: The AI understands when to retrieve historical data vs. when to use its general knowledge
3. **Comprehensive Responses**: The AI can combine function results with its own reasoning to provide detailed answers
4. **Persistent Data**: All conversation data is stored with unique timestamps for historical analysis
5. **Better UX**: No need to remember specific command syntax
