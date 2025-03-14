import { MessageActivity } from '@microsoft/spark.api';
import { Capability } from './base';

export class CapabilityManager {
  private capabilities: Map<string, Capability> = new Map();

  /**
   * Register a new capability
   */
  registerCapability(capability: Capability): void {
    if (this.capabilities.has(capability.id)) {
      throw new Error(`Capability with id ${capability.id} already registered`);
    }
    this.capabilities.set(capability.id, capability);
  }

  /**
   * Get all registered capabilities
   */
  getCapabilities(): Capability[] {
    return Array.from(this.capabilities.values());
  }

  /**
   * Find capabilities that match the given message based on keywords
   */
  findMatchingCapabilities(message: MessageActivity): Capability[] {
    const messageText = message.text.toLowerCase();
    return this.getCapabilities().filter(capability => 
      capability.keywords.some(keyword => messageText.includes(keyword.toLowerCase()))
    );
  }

  /**
   * Route a message to matching capabilities
   */
  async routeMessage(message: MessageActivity): Promise<MessageActivity[]> {
    const matchingCapabilities = this.findMatchingCapabilities(message);
    const responses: MessageActivity[] = [];

    for (const capability of matchingCapabilities) {
      const response = await capability.handleMessage(message);
      if (response) {
        responses.push(response);
      }
    }

    return responses;
  }
}
