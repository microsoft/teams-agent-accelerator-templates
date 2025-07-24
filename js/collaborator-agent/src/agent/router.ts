import { SummarizerCapability } from '../capabilities/summarize';
import { ActionItemsCapability } from '../capabilities/actionItems';
import { SearchCapability } from '../capabilities/search';
import { CapabilityResult, CapabilityOptions } from '../capabilities/capability';
import { getContextById } from '../utils/messageContext';

// Router that handles capability delegation and execution
export class CapabilityRouter {
  constructor() {
  }

  async processRequest(
    capabilityType: string,
    contextID: string,
    options: CapabilityOptions = {}
  ): Promise<CapabilityResult> {
    const messageContext = getContextById(contextID);
    if (!messageContext) {
      return {
        response: '',
        error: `Context not found for activity ID: ${contextID}`
      };
    }
    
    console.log(`🔀 Router processing ${capabilityType} capability for conversation: ${messageContext.conversationKey}`);

    switch (capabilityType.toLowerCase()) {
      case 'summarizer': {
        const summarizerCapability = new SummarizerCapability();
        return await summarizerCapability.processRequest(contextID, options);
      }

      case 'actionitems': {
        const actionItemsCapability = new ActionItemsCapability();
        await actionItemsCapability.initializeMembers(contextID);
        return await actionItemsCapability.processRequest(contextID, options);
      }

      case 'search': {
        const searchCapability = new SearchCapability();
        return await searchCapability.processRequest(contextID, options);
      }

      default: {
        console.warn(`⚠️ Unknown capability type: ${capabilityType}, defaulting to summarizer`);
        const summarizerCapability = new SummarizerCapability();
        return await summarizerCapability.processRequest(contextID, options);
      }
    }
  }
}

