import { ChatPrompt } from '@microsoft/teams.ai';
import { OpenAIChatModel } from '@microsoft/teams.openai';
import { CitationAppearance } from '@microsoft/teams.api';
import { SqliteKVStore } from '../storage/storage';
import { MANAGER_PROMPT } from './instructions';
import { getModelConfig } from '../utils/config';
import { getConversationParticipantsFromAPI } from '../capabilities/actionItems';
import { CapabilityRouter } from './router';

// Result interface for manager responses
export interface ManagerResult {
    response: string;
    delegatedCapability: string | null; // 'summarizer', 'action_items', 'search', or null for direct response
    citations?: CitationAppearance[]; // Optional citations for search results
}

// Manager prompt that coordinates all sub-tasks
export class ManagerPrompt {
    private prompt: ChatPrompt;
    private storage: SqliteKVStore;
    private currentAPI?: any;
    private currentUserId?: string;
    private currentUserName?: string;
    private currentUserTimezone?: string;
    private lastDelegatedCapability: string | null = null;
    private lastSearchCitations: CitationAppearance[] = [];
    private router: CapabilityRouter;

    constructor(storage: SqliteKVStore) {
        this.storage = storage;
        this.router = new CapabilityRouter();
        this.prompt = this.initializePrompt();
    }

    private initializePrompt(): ChatPrompt {
        const managerModelConfig = getModelConfig('manager');

        const prompt = new ChatPrompt({
            instructions: MANAGER_PROMPT,
            model: new OpenAIChatModel({
                model: managerModelConfig.model,
                apiKey: managerModelConfig.apiKey,
                endpoint: managerModelConfig.endpoint,
                apiVersion: managerModelConfig.apiVersion,
            }),
        })
            .function('delegate_to_summarizer', 'Delegate conversation analysis, summarization, or message retrieval tasks to the Summarizer Capability', {
                type: 'object',
                properties: {
                    user_request: {
                        type: 'string',
                        description: 'The original user request to be processed by the Summarizer Capability'
                    },
                    conversation_id: {
                        type: 'string',
                        description: 'The conversation ID for context'
                    },
                    calculated_start_time: {
                        type: 'string',
                        description: 'Pre-calculated start time in ISO format (optional, only if time range is specified)'
                    },
                    calculated_end_time: {
                        type: 'string',
                        description: 'Pre-calculated end time in ISO format (optional, only if time range is specified)'
                    },
                    timespan_description: {
                        type: 'string',
                        description: 'Human-readable description of the calculated time range (optional)'
                    }
                },
                required: ['user_request', 'conversation_id']
            }, async (args: any) => {
                this.lastDelegatedCapability = 'summarizer';
                console.log(`📋 DELEGATION: Delegating to Summarizer Capability via Router: "${args.user_request}" for conversation: ${args.conversation_id}`);

                const result = await this.router.processRequest('summarizer', args.user_request, {
                    conversationId: args.conversation_id,
                    userTimezone: this.currentUserTimezone,
                    calculatedStartTime: args.calculated_start_time,
                    calculatedEndTime: args.calculated_end_time,
                    timespanDescription: args.timespan_description
                });

                if (result.error) {
                    console.error(`❌ Error in Summarizer Capability: ${result.error}`);
                    return `Error in Summarizer Capability: ${result.error}`;
                }

                console.log(`📋 DELEGATION: Summarizer Capability completed. Response length: ${result.response?.length || 0}`);
                return result.response || 'No response from Summarizer Capability';
            })
            .function('delegate_to_action_items', 'Delegate task management, action item creation, or assignment tracking to the Action Items Capability', {
                type: 'object',
                properties: {
                    user_request: {
                        type: 'string',
                        description: 'The original user request to be processed by the Action Items Capability'
                    },
                    conversation_id: {
                        type: 'string',
                        description: 'The conversation ID for context'
                    },
                    calculated_start_time: {
                        type: 'string',
                        description: 'Pre-calculated start time in ISO format (optional, only if time range is specified)'
                    },
                    calculated_end_time: {
                        type: 'string',
                        description: 'Pre-calculated end time in ISO format (optional, only if time range is specified)'
                    },
                    timespan_description: {
                        type: 'string',
                        description: 'Human-readable description of the calculated time range (optional)'
                    }
                },
                required: ['user_request', 'conversation_id']
            }, async (args: any) => {
                this.lastDelegatedCapability = 'action_items';
                console.log(`📋 DELEGATION: Delegating to Action Items Capability via Router: "${args.user_request}" for conversation: ${args.conversation_id}`);

                let participantList: Array<{ name: string, id: string }> = [];
                let isPersonalChat = false;

                if (this.currentUserId && this.currentUserName) {
                    console.log(`👤 Personal mode detected for user: ${this.currentUserName} (${this.currentUserId})`);
                    isPersonalChat = true;
                    participantList = [];
                } else {
                    if (this.currentAPI) {
                        try {
                            participantList = await getConversationParticipantsFromAPI(this.currentAPI, args.conversation_id);
                        } catch (apiError) {
                            console.warn(`⚠️ Failed to get members from Teams API:`, apiError);
                            participantList = [];
                        }
                    }
                }

                const result = await this.router.processRequest('actionitems', args.user_request, {
                    conversationId: args.conversation_id,
                    userTimezone: this.currentUserTimezone,
                    storage: this.storage,
                    availableMembers: participantList,
                    isPersonalChat,
                    currentUserId: this.currentUserId,
                    currentUserName: this.currentUserName,
                    calculatedStartTime: args.calculated_start_time,
                    calculatedEndTime: args.calculated_end_time,
                    timespanDescription: args.timespan_description
                });

                return result.response || 'No response from Action Items Capability';
            })
            .function('delegate_to_search', 'Delegate conversation search, message finding, or historical conversation lookup to the Search Capability', {
                type: 'object',
                properties: {
                    user_request: {
                        type: 'string',
                        description: 'The original user request to be processed by the Search Capability'
                    },
                    conversation_id: {
                        type: 'string',
                        description: 'The conversation ID for context'
                    },
                    calculated_start_time: {
                        type: 'string',
                        description: 'Pre-calculated start time in ISO format (optional, only if time range is specified)'
                    },
                    calculated_end_time: {
                        type: 'string',
                        description: 'Pre-calculated end time in ISO format (optional, only if time range is specified)'
                    },
                    timespan_description: {
                        type: 'string',
                        description: 'Human-readable description of the calculated time range (optional)'
                    }
                },
                required: ['user_request', 'conversation_id']
            }, async (args: any) => {
                this.lastDelegatedCapability = 'search';
                console.log(`🔍 DELEGATION: Delegating to Search Capability via Router: "${args.user_request}" for conversation: ${args.conversation_id}`);

                // Create a shared array for citations
                const citationsArray: CitationAppearance[] = [];

                const result = await this.router.processRequest('search', args.user_request, {
                    conversationId: args.conversation_id,
                    userTimezone: this.currentUserTimezone,
                    citationsArray,
                    calculatedStartTime: args.calculated_start_time,
                    calculatedEndTime: args.calculated_end_time,
                    timespanDescription: args.timespan_description
                });

                // Store the citations that were added during search
                this.lastSearchCitations = citationsArray;

                return result.response || 'No response from Search Capability';
            });

        console.log('🎯 Manager initialized with delegation capabilities');
        return prompt;
    }

    async processRequestWithAPI(userRequest: string, conversationId: string, api: any, userTimezone?: string): Promise<ManagerResult> {
        try {
            console.log(`🎯 Manager processing request with API: "${userRequest}" for conversation: ${conversationId}`);
            if (userTimezone) {
                this.currentUserTimezone = userTimezone;
            }

            this.currentAPI = api;
            this.lastDelegatedCapability = null;
            this.lastSearchCitations = [];

            const response = await this.prompt.send(`
User Request: "${userRequest}"
Conversation ID: ${conversationId}

Please analyze this request and delegate it to the appropriate specialized capability. Return ONLY the response from the delegated capability without any additional commentary.
`);

            console.log(`🎯 Delegated to capability: ${this.lastDelegatedCapability || 'direct (no delegation)'}`);

            return {
                response: response.content || 'No response generated',
                delegatedCapability: this.lastDelegatedCapability,
                citations: this.lastSearchCitations.length > 0 ? this.lastSearchCitations : undefined
            };

        } catch (error) {
            console.error('❌ Error in Manager:', error);
            return {
                response: `Sorry, I encountered an error processing your request: ${error instanceof Error ? error.message : 'Unknown error'}`,
                delegatedCapability: null
            };
        } finally {
            this.currentAPI = undefined;
            this.currentUserTimezone = undefined;
        }
    }

    async processRequestWithPersonalMode(userRequest: string, conversationId: string, api: any, userId: string, userName: string, userTimezone?: string): Promise<ManagerResult> {
        try {
            console.log(`🎯 Manager processing request in personal mode: "${userRequest}" for user: ${userName} (${userId})`);
            if (userTimezone) {
                this.currentUserTimezone = userTimezone;
            }

            this.currentAPI = api;
            this.currentUserId = userId;
            this.currentUserName = userName;
            this.lastDelegatedCapability = null;
            this.lastSearchCitations = [];

            const response = await this.prompt.send(`
User Request: "${userRequest}"
Conversation ID: ${conversationId}
User ID: ${userId}
User Name: ${userName}
Context: This is a personal (1:1) chat with the user.

Please analyze this request and delegate it to the appropriate specialized capability. Return ONLY the response from the delegated capability without any additional commentary.
For action item requests, use the user's ID for personal action item management.
`);
            console.log(`🎯 Delegated to capability: ${this.lastDelegatedCapability || 'direct (no delegation)'}`);

            return {
                response: response.content || 'No response generated',
                delegatedCapability: this.lastDelegatedCapability,
                citations: this.lastSearchCitations.length > 0 ? this.lastSearchCitations : undefined
            };

        } catch (error) {
            console.error('❌ Error in Manager (personal mode):', error);
            return {
                response: `Sorry, I encountered an error processing your request: ${error instanceof Error ? error.message : 'Unknown error'}`,
                delegatedCapability: null
            };
        } finally {
            this.currentAPI = undefined;
            this.currentUserId = undefined;
            this.currentUserName = undefined;
            this.currentUserTimezone = undefined;
        }
    }

    // Method to add new specialized capabilities in the future
    addCapability(capabilityName: string, _description: string, _functionSchema: any, _handler: Function): void {
        console.log(`🔧 Adding new capability: ${capabilityName}`);
    }
}
