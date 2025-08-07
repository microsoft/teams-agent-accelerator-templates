import { MessageContext } from '../../utils/messageContext';
import { SqliteKVStore } from '../../storage/storage';
import { CitationAppearance } from '@microsoft/teams.api';
// import { TEMPLATE_PROMPT } from './prompt';
// import { templateFunctionSchema } from './schema';

// Define the interface for your capability's options
export interface TemplateOptions {
    storage?: SqliteKVStore;
    citationsArray?: CitationAppearance[];
    calculatedStartTime?: string;
    calculatedEndTime?: string;
    timespanDescription?: string;
    // Add any other options your capability needs
}

// Define the result interface for your capability
export interface TemplateResult {
    response: string;
    error?: string;
    // Add any other result properties your capability returns
}

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
    constructor() {
        // Initialize any resources your capability needs
    }

    /**
     * Process a user request within this capability's domain
     * @param context - The message context containing user info, conversation details, etc.
     * @param options - Additional options like storage, time ranges, etc.
     * @returns Promise<TemplateResult> - The result of processing the request
     */
    async processRequest(context: MessageContext, options: TemplateOptions = {}): Promise<TemplateResult> {
        try {
            console.log(`🔧 Template Capability processing request: ${context.text}`);

            // Extract relevant options
            const {
                storage,
                citationsArray,
                calculatedStartTime,
                calculatedEndTime,
                timespanDescription
            } = options;

            // TODO: Implement your capability's core logic here
            
            // Example: Basic request processing
            const userRequest = context.text;
            // const conversationId = context.conversationId;
            // const userId = context.userId;
            const userName = context.userName;
            const isPersonalChat = context.isPersonalChat;
            // const members = context.members; // Available conversation members

            // Example: Use time range if provided
            if (calculatedStartTime && calculatedEndTime) {
                console.log(`📅 Processing with time range: ${timespanDescription}`);
                // Handle time-based queries
            }

            // Example: Use storage if provided
            if (storage) {
                // Interact with storage
                // const data = await storage.get(conversationId, 'some-key');
            }

            // Example: Add citations if your capability finds relevant messages
            if (citationsArray) {
                // citationsArray.push({
                //     appearance: {
                //         name: "Relevant Message",
                //         abstract: "Description of the message"
                //     },
                //     content: "Message content"
                // });
            }

            // TODO: Replace this with your actual processing logic
            const response = `Template capability received: "${userRequest}" from user ${userName} in ${isPersonalChat ? 'personal' : 'group'} chat`;

            console.log(`✅ Template Capability completed successfully`);

            return {
                response,
                // Add any other result properties
            };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error in Template Capability';
            console.error(`❌ Error in Template Capability: ${errorMessage}`);
            
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
