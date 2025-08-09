import { Message } from '@microsoft/teams.ai';
import Database from 'better-sqlite3';
import path from 'node:path';

interface MessageRecordExtension {
  id?: number;
  conversation_id?: string;
  content: string;
  name: string;
  timestamp: string;
  activity_id?: string; // used to create deeplink for Search Capability
}

export type MessageRecord = Message & MessageRecordExtension;

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

export class SqliteKVStore {
  private db: Database.Database;

  constructor(dbPath?: string) {
    // Use environment variable if set, otherwise use provided dbPath, otherwise use default relative to project root
    const resolvedDbPath = process.env.CONVERSATIONS_DB_PATH
      ? path.resolve(process.env.CONVERSATIONS_DB_PATH)
      : dbPath
        ? dbPath
        : path.resolve(__dirname, '../../src/storage/conversations.db');
    this.db = new Database(resolvedDbPath);
    this.initializeDatabase();
  }
  private initializeDatabase(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        name TEXT NOT NULL,
        content TEXT NOT NULL,
        activity_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        blob TEXT NOT NULL
      )
    `);
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_conversation_id ON messages(conversation_id);
    `);
  }

  clearAll(): void {
    this.db.exec('DELETE FROM messages; VACUUM;');
    console.log('🧹 Cleared all messages from SQLite store.');
  }

  get(conversationId: string): MessageRecord[] {
    const stmt = this.db.prepare<{}, { blob: string }>(
      'SELECT blob FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC'
    );
    return stmt.all(conversationId).map((row) => JSON.parse(row.blob) as MessageRecord);
  }

  getMessagesByTimeRange(conversationId: string, startTime: string, endTime: string): MessageRecord[] {
    const stmt = this.db.prepare<{}, { blob: string }>(
      'SELECT blob FROM messages WHERE conversation_id = ? AND timestamp >= ? AND timestamp <= ? ORDER BY timestamp ASC'
    );
    return stmt.all([conversationId, startTime, endTime]).map(row => JSON.parse(row.blob) as MessageRecord);
  }

  getRecentMessages(conversationId: string, limit: number = 10): MessageRecord[] {
    const messages = this.get(conversationId);
    return messages.slice(-limit);
  }

  clearConversation(conversationId: string): void {
    const stmt = this.db.prepare('DELETE FROM messages WHERE conversation_id = ?');
    stmt.run(conversationId);
  }

  addMessages(messages: MessageRecord[]): void {
    const stmt = this.db.prepare(
      'INSERT INTO messages (conversation_id, role, name, content, activity_id, timestamp, blob) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    for (const message of messages) {
      stmt.run(message.conversation_id, message.role, message.name, message.content, message.activity_id, message.timestamp, JSON.stringify(message));
    }
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

  getFilteredMessages(
    conversationId: string,
    keywords: string[],
    startTime: string,
    endTime: string,
    participants?: string[],
    maxResults?: number,
  ): MessageRecord[] {
    const keywordClauses = keywords.map(() => `content LIKE ?`).join(' OR ');
    const participantClauses = participants?.map(() => `name LIKE ?`).join(' OR ');

    // Base where clauses
    const whereClauses = [
      `conversation_id = ?`,
      `timestamp >= ?`,
      `timestamp <= ?`,
      `(${keywordClauses})`
    ];

    // Values for the prepared statement
    const values: (string | number)[] = [
      conversationId,
      startTime,
      endTime,
      ...keywords.map(k => `%${k.toLowerCase()}%`)
    ];

    // Add participant filters if present
    if (participants && participants.length > 0) {
      whereClauses.push(`(${participantClauses})`);
      values.push(...participants.map(p => `%${p.toLowerCase()}%`));
    }

    const limit = maxResults && typeof maxResults === 'number' ? maxResults : 5;
    values.push(limit);

    const query = `
  SELECT blob FROM messages
  WHERE ${whereClauses.join(' AND ')}
  ORDER BY timestamp DESC
  LIMIT ?
`;

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...values) as Array<{ blob: string }>;
    return rows.map(row => JSON.parse(row.blob) as MessageRecord);
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
