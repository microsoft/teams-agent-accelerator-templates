import { SqliteKVStore, MessageRecord } from './storage';

/**
 * Universal message retrieval functions used by all capabilities
 * These functions provide a centralized interface for accessing conversation messages
 */
export class MessageManager {
  private storage: SqliteKVStore;
  private conversationMessages = new Map<string, any[]>(); // In-memory message tracking
  private activityContext = new Map<string, any>(); // Store activity context for chat type detection

  constructor(storage: SqliteKVStore) {
    this.storage = storage;
  }

  /**
   * Get all messages with timestamps for a conversation
   */
  getMessagesWithTimestamps(conversationKey: string): MessageRecord[] {
    return this.getMessagesByTimeRange(conversationKey);
  }

  /**
   * Get messages within a specific time range
   */
  getMessagesByTimeRange(conversationId: string, startTime?: string, endTime?: string): MessageRecord[] {
    try {
      let sql = 'SELECT * FROM messages WHERE conversation_id = ?';
      const params: any[] = [conversationId];

      console.log(`🔍 SQL Query Debug - Conversation: ${conversationId}`);
      console.log(`🔍 SQL Query Debug - Start time: ${startTime}`);
      console.log(`🔍 SQL Query Debug - End time: ${endTime}`);

      if (startTime) {
        sql += ' AND timestamp >= ?';
        params.push(startTime);
      }

      if (endTime) {
        sql += ' AND timestamp <= ?';
        params.push(endTime);
      }

      sql += ' ORDER BY timestamp ASC';

      console.log(`🔍 SQL Query Debug - Final SQL: ${sql}`);
      console.log(`🔍 SQL Query Debug - Parameters:`, params);

      const stmt = this.storage.getDb().prepare(sql);
      const rows = stmt.all(...params) as MessageRecord[];
      
      console.log(`🔍 Retrieved ${rows.length} messages from time range for conversation: ${conversationId}`);
      
      // Additional debugging - show first few timestamps if available
      if (rows.length > 0) {
        console.log(`🔍 SQL Query Debug - First message timestamp: ${rows[0].timestamp}`);
        console.log(`🔍 SQL Query Debug - Last message timestamp: ${rows[rows.length - 1].timestamp}`);
      }
      
      // If no results but we expected some, let's debug further
      if (rows.length === 0 && (startTime || endTime)) {
        // Get all messages to compare timestamps
        const allRows = this.storage.getDb().prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC').all(conversationId) as MessageRecord[];
        console.log(`🔍 SQL Query Debug - Total messages in conversation: ${allRows.length}`);
        if (allRows.length > 0) {
          console.log(`🔍 SQL Query Debug - Actual first timestamp: ${allRows[0].timestamp}`);
          console.log(`🔍 SQL Query Debug - Actual last timestamp: ${allRows[allRows.length - 1].timestamp}`);
          console.log(`🔍 SQL Query Debug - String comparison test:`, {
            firstVsStart: startTime ? `"${allRows[0].timestamp}" >= "${startTime}" = ${allRows[0].timestamp >= startTime}` : 'N/A',
            lastVsEnd: endTime ? `"${allRows[allRows.length - 1].timestamp}" <= "${endTime}" = ${allRows[allRows.length - 1].timestamp <= endTime}` : 'N/A'
          });
        }
      }
      
      return rows;
    } catch (error) {
      console.error(`❌ Error getting messages by time range for conversation ${conversationId}:`, error);
      return [];
    }
  }

  /**
   * Get recent messages with a limit
   */
  getRecentMessages(conversationId: string, limit: number = 10): MessageRecord[] {
    try {
      const stmt = this.storage.getDb().prepare(`
        SELECT * FROM messages 
        WHERE conversation_id = ? 
        ORDER BY id DESC 
        LIMIT ?
      `);
      
      const rows = stmt.all(conversationId, limit) as MessageRecord[];
      console.log(`🔍 Retrieved ${rows.length} recent messages for conversation: ${conversationId}`);
      
      // Log the timestamps for debugging
      if (rows.length > 0) {
        console.log(`🕐 Recent message timestamps:`, rows.map(row => ({
          id: row.id,
          timestamp: row.timestamp,
          role: row.role,
          preview: row.content.substring(0, 30) + '...'
        })));
      }
      
      return rows.reverse(); // Return in chronological order (oldest first)
    } catch (error) {
      console.error(`❌ Error getting recent messages for conversation ${conversationId}:`, error);
      return [];
    }
  }

  /**
   * Add a message to tracking (called when user sends or AI responds)
   */
  addMessageToTracking(conversationKey: string, role: string, content: string, activity?: any, name?: string): void {
    const messages = this.conversationMessages.get(conversationKey) || [];
    const newMessage = { 
      role, 
      content,
      name: name || (role === 'user' ? 'Unknown User' : 'Assistant'),
      activity_id: activity?.id || undefined
    };
    messages.push(newMessage);
    this.conversationMessages.set(conversationKey, messages);
    
    console.log(`📝 Added ${role} message from "${newMessage.name}" to tracking for ${conversationKey} (total: ${messages.length})`);
    
    if (activity) {
      this.activityContext.set(conversationKey, activity);
      const detectedType = activity?.conversation?.isGroup === false ? '1-on-1' : 'Group/Channel';
      console.log(`🎯 Detected chat type: ${detectedType}`);
    }
  }

  /**
   * Clear conversation from both tracking and storage
   */
  clearConversation(conversationKey: string): void {
    this.storage.clearConversation(conversationKey);
    this.conversationMessages.delete(conversationKey);
    this.activityContext.delete(conversationKey);
    console.log(`🧹 Cleared conversation: ${conversationKey}`);
  }

  /**
   * Save messages directly without needing a prompt
   */
  async saveMessagesDirectly(conversationKey: string): Promise<void> {
    try {
      const messages = this.conversationMessages.get(conversationKey) || [];
      console.log(`💾 Saving messages directly using tracking: ${messages.length} messages`);
      
      let messagesToStore: any[];
      const storedActivity = this.activityContext.get(conversationKey);
      const isOneOnOne = storedActivity?.conversation?.isGroup === false;
      
      if (isOneOnOne) {
        messagesToStore = messages.filter(msg => 
          msg.role === 'user' || msg.role === 'model'
        );
        console.log(`💬 1-on-1 chat: Storing user + AI messages (${messagesToStore.length}/${messages.length})`);
      } else {
        messagesToStore = messages.filter(msg => msg.role === 'user');
        console.log(`👥 Group chat: Storing user messages only (${messagesToStore.length}/${messages.length})`);
      }
      
      this.storage.set(conversationKey, messagesToStore);
      
    } catch (error) {
      console.error(`❌ Error saving messages directly for key ${conversationKey}:`, error);
    }
  }

  /**
   * Get the underlying storage instance for advanced operations
   */
  getStorage(): SqliteKVStore {
    return this.storage;
  }
}

// Create a singleton instance that can be imported by capabilities
const storage = new SqliteKVStore();
export const messageManager = new MessageManager(storage);

// Export individual functions for easy import - these are the primary interface
export function getMessagesWithTimestamps(conversationKey: string): MessageRecord[] {
  return messageManager.getMessagesWithTimestamps(conversationKey);
}

export function getMessagesByTimeRange(conversationKey: string, startTime?: string, endTime?: string): MessageRecord[] {
  return messageManager.getMessagesByTimeRange(conversationKey, startTime, endTime);
}

export function getRecentMessages(conversationKey: string, limit: number = 10): MessageRecord[] {
  return messageManager.getRecentMessages(conversationKey, limit);
}

export function getMessageStorage(): SqliteKVStore {
  return messageManager.getStorage();
}

// Message tracking functions
export function addMessageToTracking(conversationKey: string, role: string, content: string, activity?: any, name?: string): void {
  return messageManager.addMessageToTracking(conversationKey, role, content, activity, name);
}

export function clearConversation(conversationKey: string): void {
  return messageManager.clearConversation(conversationKey);
}

export async function saveMessagesDirectly(conversationKey: string): Promise<void> {
  return messageManager.saveMessagesDirectly(conversationKey);
}
