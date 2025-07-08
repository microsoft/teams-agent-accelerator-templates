# Action Items Agent - Implementation Guide

## Overview

The Action Items Agent is a sophisticated AI capability that analyzes team conversations to automatically identify, create, assign, and track action items. It integrates seamlessly with the existing Teams AI bot architecture and provides comprehensive task management functionality.

## 🚀 Features

### Core Capabilities
- **Automatic Action Item Detection**: Analyzes conversations to identify tasks, commitments, and follow-ups
- **Smart Assignment**: Assigns tasks to team members based on expertise, context, and availability
- **Priority Management**: Categorizes action items by priority (urgent, high, medium, low)
- **Status Tracking**: Manages action item lifecycle (pending, in_progress, completed, cancelled)
- **Time-based Analysis**: Can analyze specific date ranges for action item identification
- **Participant Awareness**: Knows who's in the conversation for intelligent assignment
- **Persistent Storage**: All action items stored in SQLite database with full audit trail

### Database Schema
```sql
CREATE TABLE action_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  assigned_to TEXT NOT NULL,
  assigned_by TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  priority TEXT NOT NULL DEFAULT 'medium',
  due_date DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  source_message_ids TEXT NULL -- JSON array of message IDs
);
```

## 📋 Usage Examples

### Basic Action Item Requests
```
@bot Can you identify action items from our discussion?
@bot What tasks came out of today's meeting?
@bot Create action items from the last hour of conversation
@bot Show me all pending action items
```

### Specific Time Ranges
```
@bot Analyze yesterday's conversation for action items
@bot What action items were created this week?
@bot Check last week's messages for follow-up tasks
```

### Assignment and Management
```
@bot Show action items assigned to John
@bot What are my pending tasks?
@bot Mark action item #5 as completed
@bot Update task status for item #3 to in progress
```

### Team Overview
```
@bot Give me an overview of all action items
@bot Show team workload distribution
@bot What's the priority breakdown of our tasks?
```

## 🔧 Implementation Details

### Agent Architecture
- **Location**: `src/capabilities/actionItems.ts`
- **Integration**: Connected to manager via delegation pattern
- **Storage**: Extended SQLite schema with action items table
- **Configuration**: Uses dedicated model config for optimal performance

### Function Calling Interface
The agent exposes these functions:

1. **`analyze_for_action_items`**
   - Analyzes conversation messages in a time range
   - Identifies potential action items from discussion
   - Parameters: `start_time`, `end_time` (optional)

2. **`create_action_item`**
   - Creates new action item with assignment
   - Parameters: `title`, `description`, `assigned_to`, `priority`, `due_date`

3. **`get_action_items`**
   - Retrieves existing action items with filters
   - Parameters: `assigned_to`, `status` (optional filters)

4. **`update_action_item_status`**
   - Updates status of existing action items
   - Parameters: `action_item_id`, `new_status`

5. **`get_chat_members`**
   - Gets available team members for assignment
   - Returns list of conversation participants

### Intelligent Assignment Logic
The agent uses sophisticated logic to assign tasks:

1. **Direct Assignment**: If someone volunteered or was explicitly asked
2. **Expertise-based**: Matches tasks to people's skills and roles
3. **Workload Consideration**: Avoids overloading any single person
4. **Context Ownership**: Assigns to whoever has the most relevant context

### Priority Classification
- **Urgent**: Blockers, time-sensitive deadlines, critical issues
- **High**: Important deliverables, stakeholder requests, dependencies  
- **Medium**: Regular tasks, improvements, non-critical items
- **Low**: Nice-to-have features, long-term goals, research tasks

## 🎯 Manager Integration

### Delegation Rules
The manager delegates to Action Items Agent for requests containing:
- Keywords: "action items", "tasks", "to-do", "assignments", "follow-up", "next steps"
- Task management: "create task", "assign to", "track progress", "what needs to be done"
- Status updates: "mark complete", "update status", "check progress", "pending tasks"
- Team coordination: "who is responsible", "deadlines", "priorities", "workload"
- Planning: "identify action items", "extract tasks", "create assignments"
- Personal queries: "my tasks", "what do I need to do", "my action items"

### Example Flow
1. User: `@bot What action items came out of our standup?`
2. Manager analyzes request and identifies action item keywords
3. Manager delegates to Action Items Agent
4. Action Items Agent analyzes recent conversation
5. Agent identifies tasks, assigns them appropriately
6. Returns structured summary with new action items

## 🛠️ Debug Commands

### `action.items`
Shows comprehensive action items debug information:
- All action items for current conversation
- Status breakdown with emoji indicators
- Priority levels and assignments
- Overall database statistics

Example output:
```
📋 Action Items Debug Info:

Action Items for this conversation (3):

✅ #1 🔥 Complete API integration
   👤 Assigned to: Sarah Johnson  
   📝 Finish the payment gateway integration by end of week
   📅 Created: 1/7/2025

⏳ #2 📍 Review dashboard mockups
   👤 Assigned to: Mike Chen
   📝 Review the new dashboard designs and provide feedback
   📅 Created: 1/7/2025

🔄 #3 ⚡ Update documentation
   👤 Assigned to: Alex Rodriguez
   📝 Update the API documentation with new endpoints
   📅 Created: 1/7/2025
   ⏰ Due: 1/10/2025

Overall Summary:
{
  "total_action_items": 3,
  "by_status": [
    {"status": "completed", "count": 1},
    {"status": "pending", "count": 1}, 
    {"status": "in_progress", "count": 1}
  ],
  "by_priority": [
    {"priority": "urgent", "count": 1},
    {"priority": "high", "count": 1},
    {"priority": "medium", "count": 1}
  ]
}
```

## 🔮 Future Enhancements

### Personal DM Interface (Next Phase)
- Query action items across all conversations
- Personal task dashboard
- Cross-conversation task tracking
- Deadline reminders and notifications

### Advanced Features (Roadmap)
- **Due Date Reminders**: Automated notifications for approaching deadlines
- **Workload Analytics**: Team capacity and workload visualization
- **Integration Hooks**: Connect with external task management systems
- **Smart Suggestions**: AI-powered task prioritization and assignment recommendations
- **Meeting Integration**: Automatic action item extraction from meeting transcripts
- **Progress Tracking**: Visual progress indicators and completion metrics

## 📊 Performance Considerations

- **Efficient Queries**: Indexed database fields for fast retrieval
- **Smart Caching**: Conversation participants cached for quick assignment
- **Batched Operations**: Multiple action items created efficiently
- **Memory Management**: Streaming for large conversation analysis

## 🔒 Security & Privacy

- **Conversation Isolation**: Action items scoped to specific conversations
- **Assignment Validation**: Only assigns to actual conversation participants
- **Audit Trail**: Complete history of action item changes
- **Access Control**: Future enhancement for permission-based access

## 🧪 Testing Recommendations

1. **Test Action Item Detection**:
   - Create conversations with explicit commitments
   - Test edge cases like ambiguous statements
   - Verify proper participant assignment

2. **Test Status Management**:
   - Update action item statuses
   - Verify database consistency
   - Test error handling for invalid updates

3. **Test Cross-conversation Queries**:
   - Query action items across different chats
   - Test filtering by assignee and status
   - Verify performance with large datasets

This Action Items Agent provides a solid foundation for task management within Teams conversations and can be easily extended for more advanced use cases as requirements evolve.
