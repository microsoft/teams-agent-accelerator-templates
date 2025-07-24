import { ChatPrompt } from '@microsoft/teams.ai';
import { CitationAppearance } from '@microsoft/teams.api';
import { SqliteKVStore } from '../storage/storage';
import { MessageContext, getContextById } from '../utils/messageContext';

/**
 * Configuration interface for capability-specific options
 */
export interface CapabilityOptions {
  // Storage for action items
  storage?: SqliteKVStore;
  
  // Search specific
  citationsArray?: CitationAppearance[];
  
  // Time range parameters (unified across all capabilities)
  calculatedStartTime?: string;
  calculatedEndTime?: string;
  timespanDescription?: string;
}

/**
 * Result interface for capability responses
 */
export interface CapabilityResult {
  response: string;
  citations?: CitationAppearance[];
  error?: string;
}

/**
 * Base interface that all capabilities must implement
 */
export interface Capability {
  /**
   * The name/type of this capability
   */
  readonly name: string;
  
  /**
   * Create a ChatPrompt instance for this capability
   */
  createPrompt(contextID: string, options?: CapabilityOptions): ChatPrompt;
  
  /**
   * Process a user request using this capability
   */
  processRequest(contextID: string, options?: CapabilityOptions): Promise<CapabilityResult>;
  
  /**
   * Get the function schemas that this capability provides
   */
  getFunctionSchemas(): Array<{name: string, schema: any}>;
}

/**
 * Abstract base class that provides common functionality for all capabilities
 */
export abstract class BaseCapability implements Capability {
  abstract readonly name: string;
  
  abstract createPrompt(contextID: string, options?: CapabilityOptions): ChatPrompt;
  
  abstract getFunctionSchemas(): Array<{name: string, schema: any}>;
  
  /**
   * Default implementation of processRequest that creates a prompt and sends the request
   */
  async processRequest(contextID: string, options: CapabilityOptions = {}): Promise<CapabilityResult> {
    const messageContext = getContextById(contextID);
    if (!messageContext) {
      return {
        response: '',
        error: `Context not found for activity ID: ${contextID}`
      };
    }
    
    try {
      const prompt = this.createPrompt(contextID, options);
      
      // Build enhanced request with time parameters if provided
      let enhancedRequest = messageContext.text;
      if (options.calculatedStartTime && options.calculatedEndTime) {
        enhancedRequest = `${messageContext.text}

Pre-calculated time range:
- Start: ${options.calculatedStartTime}
- End: ${options.calculatedEndTime}
- Description: ${options.timespanDescription || 'calculated timespan'}

Use these exact timestamps for any time-based queries if needed.`;
      }
      
      const response = await prompt.send(enhancedRequest);
      
      return {
        response: response.content || 'No response generated',
        citations: options.citationsArray // Return citations if they were populated during execution
      };
    } catch (error) {
      return {
        response: '',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Helper method to get model configuration
   */
  protected getModelConfig(configKey: string) {
    // This should import and use the actual getModelConfig function
    const { getModelConfig } = require('../utils/config');
    return getModelConfig(configKey);
  }
  
  /**
   * Helper method to log capability initialization
   */
  protected logInit(messageContext: MessageContext) {
    console.log(`📋 Creating ${this.name} Capability for conversation: ${messageContext.conversationKey}`);
    console.log(`🕒 Current date/time: ${messageContext.currentDateTime}`);
  }
}