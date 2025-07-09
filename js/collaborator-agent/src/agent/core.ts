import { SqliteKVStore, MessageRecord } from '../storage/storage';
import { createMockDatabase } from '../mock/mockMessages';
import { USE_MOCK_DATA, DEFAULT_MOCK_CONVERSATION } from '../utils/constants';
import { ManagerPrompt, ManagerResult } from './manager';

// Initialize storage
const storage = new SqliteKVStore();

export interface PromptManager {
  processUserRequest(conversationKey: string, userRequest: string, api: any, userTimezone?: string): Promise<ManagerResult>;
  processUserRequestWithPersonalMode(conversationKey: string, userRequest: string, api: any, userId: string, userName: string, userTimezone?: string): Promise<ManagerResult>;
  clearConversation(conversationKey: string): void;
  getMessagesWithTimestamps(conversationKey: string): MessageRecord[];
  getMessagesByTimeRange(conversationKey: string, startTime?: string, endTime?: string): MessageRecord[];
  getRecentMessages(conversationKey: string, limit?: number): MessageRecord[];
  getStorage(): SqliteKVStore;
  saveMessagesDirectly(conversationKey: string): Promise<void>;
  addMessageToTracking(conversationKey: string, role: string, content: string, activity?: any, name?: string): void;
}

export class CorePromptManager implements PromptManager {
  private manager: ManagerPrompt;
  private conversationMessages = new Map<string, any[]>(); // Our own message tracking
  private activityContext = new Map<string, any>(); // Store activity context for chat type detection

  constructor() {
    this.manager = new ManagerPrompt(storage);
  }

  // Main entry point for processing user requests with API access
  async processUserRequest(conversationKey: string, userRequest: string, api: any, userTimezone?: string): Promise<ManagerResult> {
    return await this.manager.processRequestWithAPI(userRequest, conversationKey, api, userTimezone);
  }

  // Main entry point for processing user requests with personal mode (for 1:1 chats)
  async processUserRequestWithPersonalMode(conversationKey: string, userRequest: string, api: any, userId: string, userName: string, userTimezone?: string): Promise<ManagerResult> {
    return await this.manager.processRequestWithPersonalMode(userRequest, conversationKey, api, userId, userName, userTimezone);
  }

  // Add a message to our tracking (called when user sends or AI responds)
  addMessageToTracking(conversationKey: string, role: string, content: string, activity?: any, name?: string): void {
    const messages = this.conversationMessages.get(conversationKey) || [];
    const newMessage = { 
      role, 
      content,
      name: name || (role === 'user' ? 'Unknown User' : 'Assistant'),
      activity_id: activity?.id || undefined // Store Teams activity ID for deep linking
    };
    messages.push(newMessage);
    this.conversationMessages.set(conversationKey, messages);
    
    console.log(`📝 Added ${role} message from "${newMessage.name}" to tracking for ${conversationKey} (total: ${messages.length})`);
    if (newMessage.activity_id) {
      console.log(`🔗 Activity ID stored for deep linking: ${newMessage.activity_id}`);
    }
    
    // Store or update activity context for better chat type detection
    if (activity) {
      this.activityContext.set(conversationKey, activity);
      console.log(`💾 Updated activity context for ${conversationKey}`);
      
      // Log key activity properties for debugging
      console.log(`🔍 Activity Debug Info:`);
      console.log(`  - channelId: ${activity.channelId}`);
      console.log(`  - serviceUrl: ${activity.serviceUrl}`);
      console.log(`  - conversation.id: ${activity.conversation?.id}`);
      console.log(`  - conversation.isGroup: ${activity.conversation?.isGroup}`);
      console.log(`  - conversation.conversationType: ${activity.conversation?.conversationType}`);
      console.log(`  - conversation.name: ${activity.conversation?.name || 'undefined'}`);
      console.log(`  - conversation.tenantId: ${activity.conversation?.tenantId || 'undefined'}`);
      
      // Immediate chat type detection to log the result
      const detectedType = activity?.conversation?.isGroup === false ? '1-on-1' : 'Group/Channel';
      console.log(`🎯 Detected chat type: ${detectedType}`);
    }
  }

  clearConversation(conversationKey: string): void {
    // Clear from storage
    storage.clearConversation(conversationKey);
    
    // Clear our own message tracking
    this.conversationMessages.delete(conversationKey);
    console.log(`🧹 Cleared message tracking for conversation: ${conversationKey}`);
    
    // Clear activity context
    this.activityContext.delete(conversationKey);
    console.log(`🧹 Cleared activity context for conversation: ${conversationKey}`);
  }
  
  getStorage(): SqliteKVStore {
    return storage;
  }

  // ===== Timestamp-based Message Retrieval Methods =====

  getMessagesWithTimestamps(conversationKey: string): MessageRecord[] {
    return storage.getAllMessagesWithTimestamps(conversationKey);
  }

  getMessagesByTimeRange(conversationKey: string, startTime?: string, endTime?: string): MessageRecord[] {
    return storage.getMessagesByTimeRange(conversationKey, startTime, endTime);
  }

  getRecentMessages(conversationKey: string, limit: number = 10): MessageRecord[] {
    return storage.getRecentMessages(conversationKey, limit);
  }

  // ===== Mock Database for Debug Mode =====
  
  createMockDatabase(conversationId: string = 'mock-conversation'): void {
    // Use the helper function to insert messages with custom timestamps
    const insertMessageFn = (convId: string, role: string, content: string, timestamp: string, name?: string, activityId?: string) => {
      storage.insertMessageWithTimestamp(convId, role, content, timestamp, name, activityId);
    };
    
    // Create mock database using the external function
    createMockDatabase(insertMessageFn, conversationId);
  }

  /**
   * Initialize mock data if USE_MOCK_DATA is true
   */
  initializeMockDataIfNeeded(): void {
    if (USE_MOCK_DATA) {
      console.log('🎭 Mock mode is enabled - initializing mock database...');
      this.createMockDatabase(DEFAULT_MOCK_CONVERSATION);
      console.log(`✅ Mock database initialized with conversation: ${DEFAULT_MOCK_CONVERSATION}`);
    }
  }

  // Save messages directly without needing a prompt
  async saveMessagesDirectly(conversationKey: string): Promise<void> {
    try {
      // Use our own message tracking to save directly
      const messages = this.conversationMessages.get(conversationKey) || [];
      console.log(`💾 Saving messages directly using tracking: ${messages.length} messages`);
      
      // Smart filtering based on chat type for storage optimization
      let messagesToStore: any[];
      const storedActivity = this.activityContext.get(conversationKey);
      const isOneOnOne = storedActivity?.conversation?.isGroup === false;
      
      if (isOneOnOne) {
        // Store user + AI messages (conversational content)
        messagesToStore = messages.filter(msg => 
          msg.role === 'user' || msg.role === 'model'
        );
        console.log(`💬 1-on-1 chat: Storing user + AI messages (${messagesToStore.length}/${messages.length})`);
      } else {
        // Store only user messages (group chats can get noisy)
        messagesToStore = messages.filter(msg => msg.role === 'user');
        console.log(`👥 Group chat: Storing user messages only (${messagesToStore.length}/${messages.length})`);
      }
      
      // Save filtered messages to storage
      storage.set(conversationKey, messagesToStore);
      
    } catch (error) {
      console.error(`❌ Error saving messages directly for key ${conversationKey}:`, error);
    }
  }
}

// Export singleton instance
export const promptManager = new CorePromptManager();
