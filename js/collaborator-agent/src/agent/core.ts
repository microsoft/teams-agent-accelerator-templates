import { SqliteKVStore } from '../storage/storage';
import { createMockDatabase } from '../mock/mockMessages';
import { USE_MOCK_DATA, DEFAULT_MOCK_CONVERSATION } from '../utils/constants';
import { ManagerPrompt, ManagerResult } from './manager';

// Initialize storage
const storage = new SqliteKVStore();

export interface PromptManager {
  processUserRequest(conversationKey: string, userRequest: string, api: any, userTimezone?: string): Promise<ManagerResult>;
  processUserRequestWithPersonalMode(conversationKey: string, userRequest: string, api: any, userId: string, userName: string, userTimezone?: string): Promise<ManagerResult>;
  clearConversation(conversationKey: string): void;
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

  clearConversation(conversationKey: string): void {
    storage.clearConversation(conversationKey);
    this.conversationMessages.delete(conversationKey);
    this.activityContext.delete(conversationKey);
    console.log(`🧹 Cleared conversation: ${conversationKey}`);
  }
  
  getStorage(): SqliteKVStore {
    return storage;
  }

  // ===== Mock Database for Debug Mode =====
  
  createMockDatabase(conversationId: string = 'mock-conversation'): void {
    const insertMessageFn = (convId: string, role: string, content: string, timestamp: string, name?: string, activityId?: string) => {
      storage.insertMessageWithTimestamp(convId, role, content, timestamp, name, activityId);
    };
    
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
      
      storage.set(conversationKey, messagesToStore);
      
    } catch (error) {
      console.error(`❌ Error saving messages directly for key ${conversationKey}:`, error);
    }
  }
}

// Export singleton instance
export const promptManager = new CorePromptManager();
