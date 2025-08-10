import { MessageContext } from '../../utils/messageContext';
import { ILogger } from '@microsoft/teams.common';
import { CapabilityResult } from '../capability';

/**
 * Template Capability - Replace this description with your capability's purpose
 * 
 * This template provides the basic structure for creating a new capability.
 * Replace "Template" with your capability name throughout this file.
 * 
 * Your capability should:
 * 1. Have a clear, single responsibility
 * 2. Process the user's request within its domain
 * 3. Return structured results
 * 4. Handle errors gracefully
 */
export class TemplateCapability {
    constructor(private logger: ILogger) {
        // Initialize any resources your capability needs
    }

    /**
     * Process a user request within this capability's domain
     * @param context - The message context containing user info, conversation details, etc.
     * @param options - Additional options like storage, time ranges, etc.
     * @returns Promise<TemplateResult> - The result of processing the request
     */
    async processRequest(context: MessageContext): Promise<CapabilityResult> {
        try {
            this.logger.debug(`🔧 Template Capability processing request: ${context.text}`);

            // TODO: Implement your capability's core logic here
            
            // Example: Basic request processing
            const userRequest = context.text;
            // const conversationId = context.conversationId;
            // const userId = context.userId;
            const userName = context.userName;
            const isPersonalChat = context.isPersonalChat;
            // const members = context.members; // Available conversation members


            // TODO: Replace this with your actual processing logic
            const response = `Template capability received: "${userRequest}" from user ${userName} in ${isPersonalChat ? 'personal' : 'group'} chat`;

            this.logger.debug(`✅ Template Capability completed successfully`);

            return {
                response,
                // Add any other result properties
            };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error in Template Capability';
            this.logger.error(`❌ Error in Template Capability: ${errorMessage}`);
            
            return {
                response: 'Sorry, I encountered an error processing your request.',
                error: errorMessage
            };
        }
    }

    // TODO: Add your own helper methods and validation as needed
    // Example:
    // private async helperMethod(param: string): Promise<string> {
    //     return `Processed: ${param}`;
    // }
    //
    // private validateInput(input: string): boolean {
    //     return input.length > 0;
    // }
}
