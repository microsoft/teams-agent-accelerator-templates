import { ChatPrompt } from '@microsoft/teams.ai';
import { MessageContext } from '../utils/messageContext';

/**
 * Interface for capability definition used by the manager
 */
export interface CapabilityDefinition {
  name: string;
  description: string;
  handler: (context: MessageContext) => Promise<string>;
}

/**
 * Result interface for capability responses
 */
export interface CapabilityResult {
  response: string;
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
  createPrompt(context: MessageContext): ChatPrompt;
  
  /**
   * Process a user request using this capability
   */
  processRequest(context: MessageContext): Promise<CapabilityResult>;

}

/**
 * Abstract base class that provides common functionality for all capabilities
 */
export abstract class BaseCapability implements Capability {
  abstract readonly name: string;
  
  abstract createPrompt(context: MessageContext): ChatPrompt;
  
  /**
   * Default implementation of processRequest that creates a prompt and sends the request
   */
  async processRequest(context: MessageContext): Promise<CapabilityResult> {
    try {
      const prompt = this.createPrompt(context);
      
      const response = await prompt.send(context.text);
      
      return {
        response: response.content || 'No response generated'
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
  protected logInit(context: MessageContext) {
    console.log(`📋 Creating ${this.name} Capability for conversation: ${context.conversationId}`);
    console.log(`🕒 Current date/time: ${context.timestamp}`);
  }
}