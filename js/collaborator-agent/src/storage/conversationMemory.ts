import { IMemory } from '@microsoft/teams.ai';
import { SqliteKVStore } from './storage';
import { MessageRecord } from './storage';

export class ConversationMemory implements IMemory {
    constructor(private store: SqliteKVStore, private conversationId: string) { }

    async get(index: number): Promise<MessageRecord | undefined> {
        return this.store.getMessageAtIndex(this.conversationId, index);
    }

    async set(index: number, message: MessageRecord): Promise<void> {
        this.store.updateMessageAtIndex(this.conversationId, index, message);
    }

    async delete(index: number): Promise<void> {
        this.store.deleteMessageAtIndex(this.conversationId, index);
    }

    async push(message: MessageRecord): Promise<void> {
        await this.store.addMessages(this.conversationId, [message]);
    }

    async pop(): Promise<MessageRecord | undefined> {
        return this.store.popLastMessage(this.conversationId);
    }

    async values(): Promise<MessageRecord[]> {
        return this.store.get(this.conversationId) || [];
    }

    async length(): Promise<number> {
        return this.store.countMessages(this.conversationId);
    }

    where(predicate: (value: MessageRecord, index: number) => boolean): MessageRecord[] {
        throw new Error("Synchronous 'where' is not supported in this async context.");
    }

    async collapse(): Promise<MessageRecord | undefined> {
        const messages = await this.values();
        return messages.length ? messages[messages.length - 1] : undefined;
    }
}