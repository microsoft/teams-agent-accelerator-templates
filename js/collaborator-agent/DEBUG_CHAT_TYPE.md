# Chat Type Detection Debug Guide

## Problem
The 1-on-1 chat detection might not be working correctly, causing AI responses to be excluded from storage in 1-on-1 chats.

## Improved Detection Method

The bot now uses a sophisticated multi-layer approach for detecting chat types:

### 1. **Primary Detection (Most Reliable)**
- **`activity.conversation.isGroup`**: Direct boolean indicating if conversation is a group
- **`activity.conversation.conversationType`**: "personal" for 1-on-1, other values for groups
- **Activity context**: Stored from first message for accurate detection

### 2. **Fallback Detection** 
- **Group indicators**: `@thread.v2`, `@thread.skype`, `meeting` in conversation ID
- **User indicators**: `_8:` (user identifier) in conversation ID
- **ID patterns**: Length and format analysis

## Debug Commands

### 1. Check Database Contents
```
msg.db
```
This will show you the current database contents and help verify what messages are actually being stored.

### 2. Force 1-on-1 Chat Mode
```
set.1on1
```
This manually overrides the chat type detection to treat the current conversation as a 1-on-1 chat. After this, the bot will store both user and AI messages.

### 3. Force Group Chat Mode
```
set.group
```
This manually overrides the chat type detection to treat the current conversation as a group chat. After this, the bot will store only user messages.

## What to Look For

### In Console Logs
When you send a message, look for logs like:
```
🔍 Analyzing conversation key: "your-conversation-id"
🔍 Using conversation.isGroup: false → 1-on-1
  OR
🔍 Using conversation.conversationType: personal → 1-on-1
  OR  
🔍 Falling back to ID-based detection for: "your-id"
🔍 Result: 1-on-1
💬 1-on-1 chat: Storing user + AI messages (X/Y)
```

### In Database Debug Output
After `msg.db`, check the `conversations` table entries:
- **1-on-1 mode working**: You should see both `"role": "user"` and `"role": "model"` entries
- **Group mode (or broken 1-on-1)**: You should only see `"role": "user"` entries

## Testing Steps

1. Send a message and check console logs to see what chat type was detected
2. Use `msg.db` to see what's actually stored
3. If AI responses are missing, use `set.1on1` to force 1-on-1 mode
4. Send another message and check `msg.db` again
5. You should now see both user and AI messages stored

## Teams Conversation Properties

The improved detection looks for these activity properties:

### 1-on-1 Chats:
- `activity.conversation.isGroup === false`
- `activity.conversation.conversationType === "personal"`
- ID often contains `_8:` (user identifier)

### Group/Channel Chats:
- `activity.conversation.isGroup === true`
- `activity.conversation.conversationType === "channel"` or `"groupChat"`
- ID contains `@thread.v2`, `@thread.skype`, or `meeting`

## Fix Strategy

The new detection method should work automatically for most Teams setups. If you still see issues:

1. Check the console logs to see which detection method is being used
2. Share the conversation ID format and detection results with me
3. I can fine-tune the detection logic for your specific Teams environment
4. Remove the manual override commands once automatic detection works reliably
