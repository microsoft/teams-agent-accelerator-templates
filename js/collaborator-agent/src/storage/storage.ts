import { UserMessage } from '@microsoft/teams.ai';
import Database from 'better-sqlite3';

export interface MessageRecord extends UserMessage {
  id: number;
  conversation_id: string;
  name: string;
  timestamp: string;
  activity_id?: string; // used to create deeplink for Search Capability
}

// Interface for action items
export interface ActionItem {
  id: number;
  conversation_id: string;
  title: string;
  description: string;
  assigned_to: string;
  assigned_to_id?: string; // User ID for direct lookup
  assigned_by: string; // Who identified/assigned this action item
  assigned_by_id?: string; // User ID of who assigned it
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  due_date?: string; // ISO date string
  created_at: string;
  updated_at: string;
  source_message_ids?: string; // JSON array of message IDs that led to this action item
}

// Interface for feedback on AI responses
export interface FeedbackRecord {
  id: number;
  message_id: string; // Teams message ID that was replied to
  likes: number;
  dislikes: number;
  feedbacks: string; // JSON array of feedback objects like {"feedbackText":"Nice!"}
  delegated_capability?: string; // Which sub-capability handled this response (e.g., 'summarizer', 'search', 'action_items', 'direct')
  created_at: string;
  updated_at: string;
}

// SQLite-based KV store implementation
export class SqliteKVStore {
  private db: Database.Database;

  constructor(dbPath: string = './src/storage/conversations.db') {
    this.db = new Database(dbPath);
    this.initializeDatabase();
    console.log(`🗄️ SQLite KV store initialized at: ${dbPath}`);
  }

  private initializeDatabase(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        name TEXT NOT NULL DEFAULT 'Unknown',
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        activity_id TEXT NULL
      )
    `);
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
    `);
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
    `);
  }

  get(conversationId: string): MessageRecord[] | undefined {
    try {
      const stmt = this.db.prepare(
        'SELECT id, conversation_id, role, content, name, timestamp, activity_id FROM messages WHERE conversation_id = ? ORDER BY id ASC'
      );
      return stmt.all(conversationId) as MessageRecord[];
    } catch (error) {
      console.error(`❌ Error retrieving messages for ${conversationId}:`, error);
      return undefined;
    }
  }

  set(conversationId: string, messages: MessageRecord[]): void {
    this.clearConversation(conversationId);
    const stmt = this.db.prepare(
      'INSERT INTO messages (conversation_id, role, content, name, timestamp, activity_id) VALUES (?, ?, ?, ?, ?, ?)'
    );
    for (const message of messages) {
      stmt.run(
        conversationId,
        message.role,
        message.content,
        message.name,
        message.timestamp,
        message.activity_id || null
      );
    }
  }

  delete(conversationId: string): void {
    const stmt = this.db.prepare('DELETE FROM messages WHERE conversation_id = ?');
    stmt.run(conversationId);
  }

  clearConversation(conversationId: string): void {
    this.delete(conversationId);
  }

  addMessages(conversationId: string, messages: MessageRecord[]): void {
    const stmt = this.db.prepare(
      'INSERT INTO messages (conversation_id, role, content, name, timestamp, activity_id) VALUES (?, ?, ?, ?, ?, ?)'
    );
    for (const message of messages) {
      stmt.run(
        conversationId,
        message.role,
        message.content,
        message.name,
        message.timestamp,
        message.activity_id || null
      );
    }
  }

  getMessageAtIndex(conversationId: string, index: number): MessageRecord | undefined {
    const stmt = this.db.prepare(
      'SELECT id, conversation_id, role, content, name, timestamp, activity_id FROM messages WHERE conversation_id = ? ORDER BY id ASC LIMIT 1 OFFSET ?'
    );
    return stmt.get(conversationId, index) as MessageRecord | undefined;
  }

  // Update a specific message
  updateMessageAtIndex(conversationId: string, index: number, message: MessageRecord): void {
    const selectStmt = this.db.prepare(
      'SELECT id FROM messages WHERE conversation_id = ? ORDER BY id ASC LIMIT 1 OFFSET ?'
    );
    const row = selectStmt.get(conversationId, index) as { id: number } | undefined;
    if (!row) return;

    const updateStmt = this.db.prepare(
      'UPDATE messages SET role = ?, content = ?, name = ?, activity_id = ?, timestamp = ? WHERE id = ?'
    );
    updateStmt.run(
      message.role,
      message.content,
      message.name,
      message.activity_id || null,
      message.timestamp,
      row.id
    );
  }

  // Delete a specific message
  deleteMessageAtIndex(conversationId: string, index: number): void {
    const selectStmt = this.db.prepare(
      'SELECT id FROM messages WHERE conversation_id = ? ORDER BY id ASC LIMIT 1 OFFSET ?'
    );
    const row = selectStmt.get(conversationId, index) as { id: number } | undefined;
    if (!row) return;
    const deleteStmt = this.db.prepare('DELETE FROM messages WHERE id = ?');
    deleteStmt.run(row.id);
  }

  // Pop the last message
  popLastMessage(conversationId: string): MessageRecord | undefined {
    const selectStmt = this.db.prepare(
      'SELECT id, conversation_id, role, content, name, timestamp, activity_id FROM messages WHERE conversation_id = ? ORDER BY id DESC LIMIT 1'
    );
    const row = selectStmt.get(conversationId) as MessageRecord | undefined;
    if (!row) return undefined;

    const deleteStmt = this.db.prepare('DELETE FROM messages WHERE id = ?');
    deleteStmt.run(row.id);
    return row;
  }

  countMessages(conversationId: string): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM messages WHERE conversation_id = ?');
    const result = stmt.get(conversationId) as { count: number };
    return result.count;
  }

  // Clear all messages for debugging (optional utility method)
  clearAllMessages(): void {
    try {
      const stmt = this.db.prepare('DELETE FROM messages');
      const result = stmt.run();
      console.log(`🧹 Cleared all messages from database. Deleted ${result.changes} records.`);
    } catch (error) {
      console.error('❌ Error clearing all messages:', error);
    }
  }

  // Debug function to print all database contents for a conversation
  debugPrintDatabase(conversationId: string): string {
    try {
      console.log(`🔍 DEBUG: Printing database contents for conversation: ${conversationId}`);

      // Get conversation data from conversations table
      const conversationStmt = this.db.prepare('SELECT * FROM conversations WHERE key = ?');
      const conversationData = conversationStmt.get(conversationId) as any;

      // Get individual messages from messages table
      const messagesStmt = this.db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY id ASC');
      const messageData = messagesStmt.all(conversationId) as MessageRecord[];

      // Get total counts
      const totalConversations = this.db.prepare('SELECT COUNT(*) as count FROM conversations').get() as { count: number };
      const totalMessages = this.db.prepare('SELECT COUNT(*) as count FROM messages').get() as { count: number };

      const debugInfo = {
        conversationId,
        timestamp: new Date().toISOString(),
        database_stats: {
          total_conversations: totalConversations.count,
          total_messages: totalMessages.count
        },
        conversation_table: {
          exists: !!conversationData,
          data: conversationData ? {
            key: conversationData.key,
            created_at: conversationData.created_at,
            updated_at: conversationData.updated_at,
            message_count: conversationData.value ? JSON.parse(conversationData.value).length : 0
          } : null
        },
        messages_table: {
          count: messageData.length,
          messages: messageData.map(msg => ({
            id: msg.id,
            role: msg.role,
            name: msg.name,
            timestamp: msg.timestamp,
            activity_id: msg.activity_id || null, // Include Teams activity ID for deep linking
            content_preview: msg.content.substring(0, 100) + (msg.content.length > 100 ? '...' : ''),
            content_length: msg.content.length
          }))
        }
      };

      console.log(`🔍 DEBUG INFO:`, JSON.stringify(debugInfo, null, 2));
      return JSON.stringify(debugInfo, null, 2);

    } catch (error) {
      console.error(`❌ Error debugging database for conversation ${conversationId}:`, error);
      return JSON.stringify({
        error: `Database debug failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        conversationId,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Method to insert a message with custom timestamp (for mock data)
  insertMessageWithTimestamp(conversationId: string, role: string, content: string, timestamp: string, name?: string, activityId?: string): void {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO messages (conversation_id, role, content, name, timestamp, activity_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      stmt.run(conversationId, role, content, name || 'Unknown', timestamp, activityId || null);
    } catch (error) {
      console.error(`❌ Error inserting message with custom timestamp:`, error);
    }
  }

  // ===== ACTION ITEMS MANAGEMENT =====

  // Create a new action item
  createActionItem(actionItem: Omit<ActionItem, 'id' | 'created_at' | 'updated_at'>): ActionItem {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO action_items (
          conversation_id, title, description, assigned_to, assigned_to_id, assigned_by, assigned_by_id,
          status, priority, due_date, source_message_ids
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        actionItem.conversation_id,
        actionItem.title,
        actionItem.description,
        actionItem.assigned_to,
        actionItem.assigned_to_id || null,
        actionItem.assigned_by,
        actionItem.assigned_by_id || null,
        actionItem.status,
        actionItem.priority,
        actionItem.due_date || null,
        actionItem.source_message_ids || null
      );

      const newActionItem = this.getActionItemById(result.lastInsertRowid as number);
      console.log(`✅ Created action item #${result.lastInsertRowid}: "${actionItem.title}" for ${actionItem.assigned_to}${actionItem.assigned_to_id ? ` (ID: ${actionItem.assigned_to_id})` : ''}`);
      return newActionItem!;
    } catch (error) {
      console.error(`❌ Error creating action item:`, error);
      throw error;
    }
  }

  // Get action item by ID
  getActionItemById(id: number): ActionItem | undefined {
    try {
      const stmt = this.db.prepare('SELECT * FROM action_items WHERE id = ?');
      const row = stmt.get(id) as ActionItem | undefined;
      return row;
    } catch (error) {
      console.error(`❌ Error getting action item ${id}:`, error);
      return undefined;
    }
  }

  // Get all action items for a conversation
  getActionItemsByConversation(conversationId: string): ActionItem[] {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM action_items 
        WHERE conversation_id = ? 
        ORDER BY created_at DESC
      `);
      const rows = stmt.all(conversationId) as ActionItem[];
      console.log(`🔍 Retrieved ${rows.length} action items for conversation: ${conversationId}`);
      return rows;
    } catch (error) {
      console.error(`❌ Error getting action items for conversation ${conversationId}:`, error);
      return [];
    }
  }

  // Get action items assigned to a specific person
  getActionItemsForUser(assignedTo: string, status?: string): ActionItem[] {
    try {
      let sql = 'SELECT * FROM action_items WHERE assigned_to = ?';
      const params: any[] = [assignedTo];

      if (status) {
        sql += ' AND status = ?';
        params.push(status);
      }

      sql += ' ORDER BY priority DESC, due_date ASC, created_at DESC';

      const stmt = this.db.prepare(sql);
      const rows = stmt.all(...params) as ActionItem[];
      console.log(`🔍 Retrieved ${rows.length} action items for user: ${assignedTo}${status ? ` (status: ${status})` : ''}`);
      return rows;
    } catch (error) {
      console.error(`❌ Error getting action items for user ${assignedTo}:`, error);
      return [];
    }
  }

  // Get action items assigned to a specific user by ID (for personal DMs)
  getActionItemsByUserId(userId: string, status?: string): ActionItem[] {
    try {
      let sql = 'SELECT * FROM action_items WHERE assigned_to_id = ?';
      const params: any[] = [userId];

      if (status) {
        sql += ' AND status = ?';
        params.push(status);
      }

      sql += ' ORDER BY priority DESC, due_date ASC, created_at DESC';

      const stmt = this.db.prepare(sql);
      const rows = stmt.all(...params) as ActionItem[];
      console.log(`🔍 Retrieved ${rows.length} action items for user ID: ${userId}${status ? ` (status: ${status})` : ''}`);
      return rows;
    } catch (error) {
      console.error(`❌ Error getting action items for user ID ${userId}:`, error);
      return [];
    }
  }

  // Update action item status
  updateActionItemStatus(id: number, status: ActionItem['status'], updatedBy?: string): boolean {
    try {
      const stmt = this.db.prepare(`
        UPDATE action_items 
        SET status = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `);
      const result = stmt.run(status, id);

      if (result.changes > 0) {
        console.log(`✅ Updated action item #${id} status to: ${status}${updatedBy ? ` by ${updatedBy}` : ''}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`❌ Error updating action item ${id} status:`, error);
      return false;
    }
  }

  // Clear all action items for a conversation
  clearActionItems(conversationId: string): number {
    try {
      const stmt = this.db.prepare('DELETE FROM action_items WHERE conversation_id = ?');
      const result = stmt.run(conversationId);
      console.log(`🧹 Cleared ${result.changes} action items for conversation: ${conversationId}`);
      return result.changes as number;
    } catch (error) {
      console.error(`❌ Error clearing action items for conversation ${conversationId}:`, error);
      return 0;
    }
  }

  // Clear ALL action items (for complete database reset)
  clearAllActionItems(): number {
    try {
      const stmt = this.db.prepare('DELETE FROM action_items');
      const result = stmt.run();
      console.log(`🧹 Cleared ALL action items from database: ${result.changes} items removed`);
      return result.changes as number;
    } catch (error) {
      console.error(`❌ Error clearing all action items:`, error);
      return 0;
    }
  }

  // Get action items summary for debugging
  getActionItemsSummary(): any {
    try {
      const totalItems = this.db.prepare('SELECT COUNT(*) as count FROM action_items').get() as { count: number };
      const statusCounts = this.db.prepare(`
        SELECT status, COUNT(*) as count 
        FROM action_items 
        GROUP BY status
      `).all() as { status: string; count: number }[];

      const priorityCounts = this.db.prepare(`
        SELECT priority, COUNT(*) as count 
        FROM action_items 
        GROUP BY priority
      `).all() as { priority: string; count: number }[];

      return {
        total_action_items: totalItems.count,
        by_status: statusCounts,
        by_priority: priorityCounts
      };
    } catch (error) {
      console.error(`❌ Error getting action items summary:`, error);
      return { error: 'Failed to get summary' };
    }
  }

  // Get all action items across all conversations (for debugging)
  getAllActionItems(): ActionItem[] {
    try {
      const sql = 'SELECT * FROM action_items ORDER BY created_at DESC';
      const stmt = this.db.prepare(sql);
      const rows = stmt.all() as ActionItem[];
      console.log(`🔍 Retrieved ${rows.length} action items across all conversations`);
      return rows;
    } catch (error) {
      console.error(`❌ Error getting all action items:`, error);
      return [];
    }
  }

  // ===== FEEDBACK MANAGEMENT =====

  // Initialize feedback record for a message with optional delegated capability
  initializeFeedbackRecord(messageId: string, delegatedCapability?: string): FeedbackRecord {
    try {
      const stmt = this.db.prepare(`
        INSERT OR IGNORE INTO feedback (message_id, likes, dislikes, feedbacks, delegated_capability)
        VALUES (?, 0, 0, '[]', ?)
      `);
      stmt.run(messageId, delegatedCapability || null);

      const selectStmt = this.db.prepare('SELECT * FROM feedback WHERE message_id = ?');
      const record = selectStmt.get(messageId) as FeedbackRecord;
      console.log(`📝 Initialized feedback record for message: ${messageId}${delegatedCapability ? ` (capability: ${delegatedCapability})` : ''}`);
      return record;
    } catch (error) {
      console.error(`❌ Error initializing feedback record for message ${messageId}:`, error);
      throw error;
    }
  }

  // Store delegated capability info for a message (for later feedback initialization)
  storeDelegatedCapability(messageId: string, delegatedCapability: string | null): void {
    try {
      const stmt = this.db.prepare(`
        INSERT OR IGNORE INTO feedback (message_id, likes, dislikes, feedbacks, delegated_capability)
        VALUES (?, 0, 0, '[]', ?)
      `);
      stmt.run(messageId, delegatedCapability);
      console.log(`📝 Stored delegated capability info for message ${messageId}: ${delegatedCapability || 'direct'}`);
    } catch (error) {
      console.error(`❌ Error storing delegated capability for message ${messageId}:`, error);
    }
  }

  // Get feedback record by message ID
  getFeedbackByMessageId(messageId: string): FeedbackRecord | undefined {
    try {
      const stmt = this.db.prepare('SELECT * FROM feedback WHERE message_id = ?');
      const record = stmt.get(messageId) as FeedbackRecord | undefined;
      return record;
    } catch (error) {
      console.error(`❌ Error getting feedback for message ${messageId}:`, error);
      return undefined;
    }
  }

  // Update feedback record with new reaction and feedback text
  updateFeedback(messageId: string, reaction: 'like' | 'dislike', feedbackJson?: any): boolean {
    try {
      // Get existing feedback or create new one
      let existingFeedback = this.getFeedbackByMessageId(messageId);
      if (!existingFeedback) {
        existingFeedback = this.initializeFeedbackRecord(messageId);
      }

      // Parse existing feedbacks array
      let feedbacks: any[] = [];
      try {
        feedbacks = JSON.parse(existingFeedback.feedbacks);
      } catch (e) {
        feedbacks = [];
      }

      // Add new feedback if provided
      if (feedbackJson) {
        feedbacks.push(feedbackJson);
      }

      // Update counts
      const newLikes = existingFeedback.likes + (reaction === 'like' ? 1 : 0);
      const newDislikes = existingFeedback.dislikes + (reaction === 'dislike' ? 1 : 0);

      // Update database
      const stmt = this.db.prepare(`
        UPDATE feedback 
        SET likes = ?, dislikes = ?, feedbacks = ?, updated_at = CURRENT_TIMESTAMP
        WHERE message_id = ?
      `);
      const result = stmt.run(newLikes, newDislikes, JSON.stringify(feedbacks), messageId);

      console.log(`👍 Updated feedback for message ${messageId}: ${reaction} (likes: ${newLikes}, dislikes: ${newDislikes})`);
      return result.changes > 0;
    } catch (error) {
      console.error(`❌ Error updating feedback for message ${messageId}:`, error);
      return false;
    }
  }

  // Get all feedback records (for debugging)
  getAllFeedback(): FeedbackRecord[] {
    try {
      const stmt = this.db.prepare('SELECT * FROM feedback ORDER BY created_at DESC');
      const records = stmt.all() as FeedbackRecord[];
      console.log(`🔍 Retrieved ${records.length} feedback records`);
      return records;
    } catch (error) {
      console.error(`❌ Error getting all feedback records:`, error);
      return [];
    }
  }

  // Clear all feedback records
  clearAllFeedback(): number {
    try {
      const stmt = this.db.prepare('DELETE FROM feedback');
      const result = stmt.run();
      console.log(`🧹 Cleared ALL feedback records: ${result.changes} records removed`);
      return result.changes as number;
    } catch (error) {
      console.error(`❌ Error clearing all feedback:`, error);
      return 0;
    }
  }

  // Get feedback summary for analytics
  getFeedbackSummary(): any {
    try {
      const totalFeedback = this.db.prepare('SELECT COUNT(*) as count FROM feedback').get() as { count: number };
      const totalLikes = this.db.prepare('SELECT SUM(likes) as total FROM feedback').get() as { total: number };
      const totalDislikes = this.db.prepare('SELECT SUM(dislikes) as total FROM feedback').get() as { total: number };

      return {
        total_feedback_records: totalFeedback.count,
        total_likes: totalLikes.total || 0,
        total_dislikes: totalDislikes.total || 0,
        like_ratio: totalLikes.total && totalDislikes.total ?
          (totalLikes.total / (totalLikes.total + totalDislikes.total) * 100).toFixed(1) + '%' :
          'N/A'
      };
    } catch (error) {
      console.error(`❌ Error getting feedback summary:`, error);
      return { error: 'Failed to get feedback summary' };
    }
  }

  /**
   * Get the underlying database instance for direct SQL operations
   */
  getDb(): Database.Database {
    return this.db;
  }
}
