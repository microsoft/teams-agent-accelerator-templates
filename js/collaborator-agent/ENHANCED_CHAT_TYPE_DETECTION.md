# Enhanced Chat Type Detection System

This document describes the improved chat type detection system for distinguishing between 1-on-1 chats and group chats in Microsoft Teams using the Teams AI Library v2.

## Overview

The enhanced system uses multiple detection methods in order of reliability:

1. **Activity Context Analysis** (Most Reliable)
2. **Enhanced ID Pattern Analysis** (Fallback)
3. **Score-Based Detection** (Edge Cases)

## Detection Methods

### Method 1: Activity Context Analysis

Based on the official Teams AI Library documentation, the most reliable way to detect chat type is through the activity object properties:

#### Primary Properties (Most Reliable)
- `activity.conversation.isGroup` - Boolean indicating if conversation is a group
- `activity.conversation.conversationType` - "personal" for 1-on-1, other values for groups

#### Secondary Properties
- `activity.conversation.name` - Groups/channels typically have names
- `activity.conversation.tenantId` - Present in tenant conversations
- `activity.channelData.team` - Indicates team/channel context
- `activity.channelData.channel` - Indicates channel context
- `activity.channelData.meeting` - Indicates meeting context
- `activity.membersAdded` - Multiple members suggest group context

### Method 2: Enhanced ID Pattern Analysis

When activity context is insufficient, we analyze conversation ID patterns:

#### Group/Channel Indicators
- `@thread.v2` - Standard Teams group threads
- `@thread.skype` - Legacy Skype for Business threads  
- `@thread.tacv2` - Teams channel threads
- `meeting` or `@meet` - Meeting conversations
- `19:...@thread` - Channel pattern

#### 1-on-1 Indicators
- `28:` or `8:` - User ID patterns
- `a:` or `f:` - Personal chat prefixes
- Short IDs (< 80 characters)
- Simple structure (no @ or minimal @ usage)

### Method 3: Score-Based Detection

For edge cases, we use a scoring system:
- User ID pattern: +3 points
- Personal chat pattern: +2 points  
- Short ID: +1 point
- Simple ID structure: +1 point

Threshold: ≥2 points = 1-on-1 chat

## Storage Optimization

Based on chat type detection, messages are stored differently:

### 1-on-1 Chats
- **Store**: User + AI messages
- **Reason**: Conversational flow is important in personal chats
- **Example**: Customer support, personal assistance

### Group/Channel Chats
- **Store**: User messages only
- **Reason**: Reduces noise, focuses on user inputs
- **Example**: Team collaboration, broadcast channels

## Debug Commands

### `msg.db`
Shows database contents for debugging storage and message history.

## Implementation Details

### Activity Context Persistence
- Activity context is stored on first message and updated on subsequent messages
- Context includes full conversation object for reliable detection
- Used for both initial detection and later storage decisions

### Comprehensive Logging
- Detailed console output shows detection logic
- All detection methods are logged with their results
- Activity properties are logged for debugging

### Fallback Strategy
If all detection methods fail, the system defaults to group chat behavior (safer for storage optimization).

## Usage Examples

```typescript
// Automatic detection with activity context
const isOneOnOne = promptManager.isOneOnOneChat(conversationKey, activity);
```

## Teams AI Library v2 Integration

This implementation leverages Teams AI Library v2 patterns:

- Uses activity object structure as documented
- Follows Teams-specific conversation patterns
- Integrates with Teams AI function calling system
- Compatible with Teams AI storage mechanisms

## Testing Recommendations

1. Test in different conversation types:
   - 1-on-1 personal chats
   - Small group chats
   - Large teams/channels
   - Meeting chats

2. Use debug commands to verify detection:
   ```
   msg.db            # Verify storage behavior and message history
   ```

3. Monitor console output for detection logic and activity context analysis

## Benefits

1. **More Accurate Detection**: Uses Teams AI Library best practices
2. **Comprehensive Analysis**: Multiple detection methods with fallbacks
3. **Better Debugging**: Detailed logging and activity context analysis
4. **Storage Optimization**: Smart message filtering based on chat type
5. **Future-Proof**: Score-based system handles edge cases and new patterns

## Future Enhancements

- Machine learning-based detection for edge cases
- User preference settings for storage behavior
- Analytics on detection accuracy
- Integration with Teams Graph API for additional context
