import { ChatPrompt } from '@microsoft/teams.ai';
import { OpenAIChatModel } from '@microsoft/teams.openai';
import { MANAGER_PROMPT } from './prompt';
import { getModelConfig } from '../utils/config';
import { MessageContext } from '../utils/messageContext';
import { extractTimeRange } from '../utils/utils';
import { CAPABILITY_DEFINITIONS } from '../capabilities/registry';

// Result interface for manager responses
export interface ManagerResult {
    response: string;
}

// Manager prompt that coordinates all sub-tasks
export class ManagerPrompt {
    private prompt: ChatPrompt;

    constructor(private context: MessageContext) {
        this.prompt = this.createManagerPrompt();
    }

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
            messages: this.context.memory.values()
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

            this.context.startTime = timeRange ? timeRange?.from.toISOString() : this.context.endTime;
            this.context.endTime = timeRange ? timeRange?.to.toISOString() : this.context.endTime;

            console.log(this.context.startTime);
            console.log(this.context.endTime);
        }).function('clear_conversation_history', 'Clear conversation history in the database for the current conversation',
            async () => {
                this.context.memory.clear();
            }
        );

        return prompt;
    }

    private addCapabilities() {
        for (const capability of CAPABILITY_DEFINITIONS) {
            this.prompt.function(
                capability.name,
                capability.description,
                async () => {
                    return capability.handler(this.context);
                }
            );
        }
    }

    async processRequest(): Promise<ManagerResult> {
        try {
            this.addCapabilities();

            const response = await this.prompt.send(this.context.text);

            return {
                response: response.content || 'No response generated'
            };

        } catch (error) {
            console.error('❌ Error in Manager:', error);
            return {
                response: `Sorry, I encountered an error processing your request: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }
}
