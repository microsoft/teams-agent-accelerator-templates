import { SqliteKVStore } from './storage';
import { MessageRecord } from './storage';

export class ConversationMemory {

    constructor(private store: SqliteKVStore, private conversationId: string) {
    }

    async addMessages(messages: MessageRecord[]): Promise<void> {
        console.log(messages);
        await this.store.addMessages(messages);
    }

    values(): MessageRecord[] {
        return this.store.get(this.conversationId) || [];
    }

    length(): number {
        return this.store.countMessages(this.conversationId);
    }

    clear() {
        this.store.clearConversation(this.conversationId);
    }

    getMessagesByTimeRange(startTime: string, endTime: string): MessageRecord[] {
        return this.store.getMessagesByTimeRange(this.conversationId, startTime, endTime);
    }

    getRecentMessages(limit: number): MessageRecord[] {
        return this.store.getRecentMessages(this.conversationId, limit);
    }
}