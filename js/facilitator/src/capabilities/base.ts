import { MessageActivity } from '@microsoft/spark.api';

/**
 * Base interface that all capabilities must implement
 */
export interface Capability {
  /**
   * Unique identifier for this capability
   */
  id: string;

  /**
   * Human readable name of the capability
   */
  name: string;

  /**
   * Brief description of what this capability does
   */
  description: string;

  /**
   * Keywords that trigger this capability
   */
  keywords: string[];

  /**
   * Handle an incoming message activity
   * @param message The message to process
   * @returns Response message activity or null if no response
   */
  handleMessage(message: MessageActivity): Promise<MessageActivity | null>;
}
