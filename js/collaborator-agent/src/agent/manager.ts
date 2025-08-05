import { ChatPrompt } from '@microsoft/teams.ai';
import { OpenAIChatModel } from '@microsoft/teams.openai';
import { CitationAppearance } from '@microsoft/teams.api';
import { SqliteKVStore } from '../storage/storage';
import { MANAGER_PROMPT } from './prompt';
import { getModelConfig } from '../utils/config';
import { MessageContext } from '../utils/messageContext';
import { extractTimeRange } from '../utils/utils';
import { CAPABILITY_DEFINITIONS } from '../capabilities/registry';

// Result interface for manager responses
export interface ManagerResult {
    response: string;
    delegatedCapability: string | null;
    citations?: CitationAppearance[];
}

// State that gets created per request
interface ManagerState {
    delegatedCapability: string | null;
    searchCitations: CitationAppearance[];
}

// Manager prompt that coordinates all sub-tasks
export class ManagerPrompt {
    private storage: SqliteKVStore;

    constructor(storage: SqliteKVStore) {
        this.storage = storage;
    }

    // Create a prompt with context-specific handlers
    private createManagerPrompt(): ChatPrompt {
        const managerModelConfig = getModelConfig('manager');
        let prompt = new ChatPrompt({
            instructions: MANAGER_PROMPT,
            model: new OpenAIChatModel({
                model: managerModelConfig.model,
                apiKey: managerModelConfig.apiKey,
                endpoint: managerModelConfig.endpoint,
                apiVersion: managerModelConfig.apiVersion,
            }),
        }).function('calculate_time_range', 'Parse natural language time expressions and calculate exact start/end times for time-based queries', {
            type: 'object' as const,
            properties: {
                time_phrase: {
                    type: 'string' as const,
                    description: 'Natural language time expression extracted from the user request (e.g., "yesterday", "last week", "2 days ago", "past 3 hours")'
                }
            },
            required: ['time_phrase']
        }, async (args: any) => {
            console.log(`🕒 FUNCTION CALL: calculate_time_range - parsing "${args.time_phrase}"`);

            const timeRange = extractTimeRange(args.time_phrase);

            if (!timeRange) {
                console.warn(`⚠️ Could not parse time phrase: "${args.time_phrase}"`);
                return JSON.stringify({
                    status: 'error',
                    message: `Could not parse time expression: "${args.time_phrase}"`
                });
            }

            const startTime = timeRange.from.toISOString();
            const endTime = timeRange.to.toISOString();
            const description = `${args.time_phrase} (${timeRange.from.toLocaleDateString()} to ${timeRange.to.toLocaleDateString()})`;

            console.log(`📅 Parsed "${args.time_phrase}" to: ${startTime} → ${endTime}`);

            return JSON.stringify({
                status: 'success',
                calculated_start_time: startTime,
                calculated_end_time: endTime,
                timespan_description: description
            });
        });

        return prompt;
    }

    private addCapabilities(prompt: ChatPrompt, context: MessageContext, state: ManagerState) {
        for (const capability of CAPABILITY_DEFINITIONS) {
            prompt = prompt.function(
                capability.name,
                capability.description,
                capability.schema,
                async (args: any) => {
                    return capability.handler(args, context, state, this.storage);
                }
            );
        }
    }

    async processRequest(context: MessageContext): Promise<ManagerResult> {
        try {
            // Create state for this request
            const state: ManagerState = {
                delegatedCapability: null,
                searchCitations: []
            };

            const prompt = this.createManagerPrompt();

            this.addCapabilities(prompt, context, state);

            const contextInfo = context.isPersonalChat
                ? `Context: This is a personal (1:1) chat with ${context.userName} (${context.userId}).`
                : `Context: This is a group conversation.`;

            const response = await prompt.send(`
User Request: "${context.text}"
Conversation ID: ${context.conversationKey}
Current Date/Time: ${context.currentDateTime}
${contextInfo}

IMPORTANT: If the user's request mentions any time periods, extract the time-related phrase and use the calculate_time_range function FIRST to convert it to exact timestamps, then pass those calculated times to the delegation functions.

Please analyze this request and delegate it to the appropriate specialized capability. Return ONLY the response from the delegated capability without any additional commentary.
For action item requests in personal chats, use the user's ID for personal action item management.
`);

            return {
                response: response.content || 'No response generated',
                delegatedCapability: state.delegatedCapability,
                citations: state.searchCitations.length > 0 ? state.searchCitations : undefined
            };

        } catch (error) {
            console.error('❌ Error in Manager:', error);
            return {
                response: `Sorry, I encountered an error processing your request: ${error instanceof Error ? error.message : 'Unknown error'}`,
                delegatedCapability: null
            };
        }
    }
}
