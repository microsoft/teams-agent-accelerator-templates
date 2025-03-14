import { MessageActivity } from '@microsoft/spark.api';
import { CapabilityManager } from '../capabilities/manager';

export class MessageRouter {
  constructor(private capabilityManager: CapabilityManager) {}

  /**
   * Process an incoming message and route it to matching capabilities
   */
  async routeMessage(message: MessageActivity): Promise<MessageActivity[]> {
    // Get responses from all matching capabilities
    const responses = await this.capabilityManager.routeMessage(message);
    return responses;
  }
}
