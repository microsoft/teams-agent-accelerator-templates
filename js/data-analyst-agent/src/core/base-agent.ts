import OpenAI, { AzureOpenAI } from "openai";
import { ChatCompletionCreateParamsNonStreaming, ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { Logger } from './logging';

export interface JsonSchema extends Record<string, unknown> {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
    additionalProperties?: boolean;
}

export interface BaseAgentOptions {
    model?: string;
    systemMessage: string;
    responseSchema?: JsonSchema;
    logger: Logger;
    maxLoops?: number;
}

export class BaseAgent {
    private openai: OpenAI;
    private options: BaseAgentOptions;
    private functions: Array<{
        name: string;
        description: string;
        parameters: JsonSchema;
        handler: (args: any) => Promise<string>;
    }> = [];
    private messages: ChatCompletionMessageParam[] = [];

    constructor(options: BaseAgentOptions) {
        this.options = {
            maxLoops: 5,
            ...options
        };

        this.openai = this.getOpenAIClient();

        // Initialize messages with system message
        this.messages = [{
            role: 'system',
            content: this.options.systemMessage
        }];
    }

    function(
        name: string,
        description: string,
        parameters: {
            type: "object";
            properties: Record<string, any>;
            required?: string[];
        },
        handler: (args: any) => Promise<string>
    ): this {
        this.functions.push({ name, description, parameters, handler });
        return this;
    }

    private getCompletionOptions(messages: ChatCompletionMessageParam[]): ChatCompletionCreateParamsNonStreaming {
        return {
            model: this.options.model || process.env.DEFAULT_LLM_MODEL || 'gpt-4o-mini',
            messages,
            response_format: this.options.responseSchema ? {
                type: "json_schema",
                json_schema: {
                    name: "response",
                    schema: this.options.responseSchema,
                    strict: false
                }
            } : undefined,
            tools: this.functions.length > 0 ? this.functions.map(fn => ({
                type: 'function' as const,
                function: {
                    name: fn.name,
                    description: fn.description,
                    parameters: fn.parameters
                }
            })) : undefined
        };
    }

    async chat(message: string): Promise<any> {
        this.options.logger.info(`User Message: ${message}`);
        
        // Add user message to conversation history
        this.messages.push({ role: "user", content: message });
        
        let loopCount = 0;
        
        while (true) {
            if (loopCount >= this.options.maxLoops!) {
                throw new Error('Max loops reached');
            }

            loopCount++;
            this.options.logger.trace(`Loop ${loopCount} of ${this.options.maxLoops}`);
            
            const completion = await this.openai.chat.completions.create(
                this.getCompletionOptions(this.messages)
            );

            const response = completion.choices[0].message;
            
            if (response.tool_calls && response.tool_calls.length > 0) {
                this.options.logger.trace(`Processing ${response.tool_calls.length} tool calls`);
                
                const toolResults = await Promise.all(
                    response.tool_calls.map(async (toolCall) => {
                        const fn = this.functions.find(f => f.name === toolCall.function.name);
                        if (!fn) {
                            throw new Error(`Unknown function: ${toolCall.function.name}`);
                        }

                        const args = JSON.parse(toolCall.function.arguments);
                        this.options.logger.trace(`Calling ${toolCall.function.name} with args: ${JSON.stringify(args, null, 2)}`);
                        
                        const result = await fn.handler(args);
                        this.options.logger.trace(`${toolCall.function.name} result: ${result}`);
                        
                        return {
                            tool_call_id: toolCall.id,
                            output: result
                        };
                    })
                );

                // Add assistant response and tool results to conversation history
                this.messages.push(response);
                this.messages.push(...toolResults.map(result => ({
                    role: 'tool' as const,
                    tool_call_id: result.tool_call_id,
                    content: result.output
                })));

                continue;
            }

            // Add final assistant response to conversation history
            this.messages.push(response);

            if (this.options.responseSchema) {
                return JSON.parse(response.content!);
            }

            return response.content;
        }
    }

    private getOpenAIClient(): OpenAI {
        if (process.env.OPENAI_API_KEY) {
            return new OpenAI({
                apiKey: process.env.OPENAI_API_KEY,
            });
        }

        if (process.env.AZURE_OPENAI_API_KEY 
            && process.env.AZURE_OPENAI_API_BASE
            && process.env.AZURE_OPENAI_API_VERSION) {
            return new AzureOpenAI({
                apiKey: process.env.AZURE_OPENAI_API_KEY,
                endpoint: process.env.AZURE_OPENAI_API_BASE,
                apiVersion: process.env.AZURE_OPENAI_API_VERSION,
            });
        }

        throw new Error('Incomplete OpenAI & Azure OpenAI configuration');
    }
}
