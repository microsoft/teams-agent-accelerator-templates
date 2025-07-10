import { SqliteKVStore } from '../storage/storage';
import { createMockDatabase } from '../mock/mockMessages';
import { USE_MOCK_DATA, DEFAULT_MOCK_CONVERSATION } from '../utils/constants';

/**
 * Mock database utilities
 */
export class MockDataManager {
  private storage: SqliteKVStore;

  constructor(storage: SqliteKVStore) {
    this.storage = storage;
  }

  createMockDatabase(conversationId: string = 'mock-conversation'): void {
    const insertMessageFn = (convId: string, role: string, content: string, timestamp: string, name?: string, activityId?: string) => {
      this.storage.insertMessageWithTimestamp(convId, role, content, timestamp, name, activityId);
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
}
