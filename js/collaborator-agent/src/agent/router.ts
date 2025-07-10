import { ChatPrompt } from '@microsoft/teams.ai';
import { CitationAppearance } from '@microsoft/teams.api';
import { SqliteKVStore } from '../storage/storage';
import { createSummarizerPrompt } from '../capabilities/summarize';
import { createActionItemsPrompt } from '../capabilities/actionItems';
import { createSearchPrompt } from '../capabilities/search';

// Router that provides specific prompts for different capability types
export async function routeToPrompt(
  capabilityType: string, 
  conversationId: string, 
  storage: SqliteKVStore, 
  participants: Array<{name: string, id: string}> = [], 
  userTimezone?: string,
  citationsArray?: CitationAppearance[]
): Promise<ChatPrompt> {
  console.log(`🔀 Routing to ${capabilityType} capability for conversation: ${conversationId}`);
  
  switch (capabilityType.toLowerCase()) {
    case 'summarizer':
      return createSummarizerPrompt(conversationId, userTimezone);
    
    case 'actionitems':
    case 'action_items':
      return createActionItemsPrompt(conversationId, storage, participants, false, undefined, undefined, userTimezone);
    
    case 'search':
      return createSearchPrompt(conversationId, userTimezone, citationsArray);
    
    default:
      console.warn(`⚠️ Unknown capability type: ${capabilityType}, defaulting to summarizer`);
      return createSummarizerPrompt(conversationId, userTimezone);
  }
}

// Factory function for creating new capability types
export function createCapabilityRouter(): {
  addRoute: (capabilityType: string, factory: (conversationId: string, userTimezone?: string) => ChatPrompt) => void;
  route: (capabilityType: string, conversationId: string, userTimezone?: string) => Promise<ChatPrompt>;
} {
  const routes = new Map<string, (conversationId: string, userTimezone?: string) => ChatPrompt>();
  
  routes.set('summarizer', createSummarizerPrompt);
  
  return {
    addRoute: (capabilityType: string, factory: (conversationId: string, userTimezone?: string) => ChatPrompt) => {
      routes.set(capabilityType.toLowerCase(), factory);
    },
    route: async (capabilityType: string, conversationId: string, userTimezone?: string) => {
      const factory = routes.get(capabilityType.toLowerCase()) || routes.get('summarizer')!;
      return factory(conversationId, userTimezone);
    }
  };
}

