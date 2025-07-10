import { ChatPrompt } from '@microsoft/teams.ai';
import { OpenAIChatModel } from '@microsoft/teams.openai';
import { CitationAppearance } from '@microsoft/teams.api';
import { SqliteKVStore } from '../storage/storage';
import { MANAGER_PROMPT } from './instructions';
import { getModelConfig } from '../utils/config';
import { routeToPrompt } from './router';
import { createActionItemsPrompt, getConversationParticipantsFromAPI } from '../capabilities/actionItems';

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

    constructor(storage: SqliteKVStore) {
        this.storage = storage;
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
                    }
                },
                required: ['user_request', 'conversation_id']
            }, async (args: any) => {
                this.lastDelegatedCapability = 'summarizer';
                return await this.delegateToSummarizer(args.user_request, args.conversation_id);
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
                    }
                },
                required: ['user_request', 'conversation_id']
            }, async (args: any) => {
                this.lastDelegatedCapability = 'action_items';
                return await this.delegateToActionItems(args.user_request, args.conversation_id);
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
                    }
                },
                required: ['user_request', 'conversation_id']
            }, async (args: any) => {
                this.lastDelegatedCapability = 'search';
                return await this.delegateToSearch(args.user_request, args.conversation_id);
            });

        console.log('🎯 Manager initialized with delegation capabilities');
        return prompt;
    }

    async processRequest(userRequest: string, conversationId: string, userTimezone?: string): Promise<ManagerResult> {
        try {
            console.log(`🎯 Manager processing request: "${userRequest}" for conversation: ${conversationId}`);
            if (userTimezone) {
                this.currentUserTimezone = userTimezone;
            }

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
        }
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

    private async delegateToSummarizer(userRequest: string, conversationId: string): Promise<string> {
        try {
            console.log(`📋 DELEGATION: Delegating to Summarizer Capability: "${userRequest}" for conversation: ${conversationId}`);

            const summarizerPrompt = await routeToPrompt('summarizer', conversationId, this.storage, [], this.currentUserTimezone);
            const response = await summarizerPrompt.send(userRequest);

            console.log(`📋 DELEGATION: Summarizer Capability completed task. Response length: ${response.content?.length || 0}`);
            return response.content || 'No response from Summarizer Capability';

        } catch (error) {
            console.error('❌ Error delegating to Summarizer Capability:', error);
            return JSON.stringify({
                status: 'error',
                message: `Error in Summarizer Capability: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
        }
    }

    private async delegateToActionItems(userRequest: string, conversationId: string): Promise<string> {
        try {
            console.log(`📋 DELEGATION: Delegating to Action Items Capability: "${userRequest}" for conversation: ${conversationId}`);

            let participantList: Array<{ name: string, id: string }> = [];
            let isPersonalChat = false;

            if (this.currentUserId && this.currentUserName) {
                console.log(`👤 Personal mode detected for user: ${this.currentUserName} (${this.currentUserId})`);
                isPersonalChat = true;
                participantList = [];
            } else {
                if (this.currentAPI) {
                    try {
                        console.log(`👥 Fetching conversation members from Teams API...`);
                        participantList = await getConversationParticipantsFromAPI(this.currentAPI, conversationId);
                    } catch (apiError) {
                        console.warn(`⚠️ Failed to get members from Teams API:`, apiError);
                        participantList = [];
                    }
                } else {
                    console.warn(`⚠️ No Teams API available for action items capability`);
                    participantList = [];
                }
            }

            const actionItemsPrompt = createActionItemsPrompt(
                conversationId,
                this.storage,
                participantList,
                isPersonalChat,
                this.currentUserId,
                this.currentUserName,
                this.currentUserTimezone
            );

            const response = await actionItemsPrompt.send(userRequest);

            console.log(`📋 DELEGATION: Action Items Capability completed task. Response length: ${response.content?.length || 0}`);
            return response.content || 'No response from Action Items Capability';

        } catch (error) {
            console.error('❌ Error delegating to Action Items Capability:', error);
            return JSON.stringify({
                status: 'error',
                message: `Error in Action Items Capability: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
        }
    }

    private async delegateToSearch(userRequest: string, conversationId: string): Promise<string> {
        try {
            console.log(`🔍 DELEGATION: Delegating to Search Capability: "${userRequest}" for conversation: ${conversationId}`);

            // Create a shared array for citations
            const citationsArray: CitationAppearance[] = [];
            const searchPrompt = await routeToPrompt('search', conversationId, this.storage, [], this.currentUserTimezone, citationsArray);
            const response = await searchPrompt.send(userRequest);

            // Store the citations that were added during search
            this.lastSearchCitations = citationsArray;

            console.log(`🔍 DELEGATION: Search Capability completed task. Response length: ${response.content?.length || 0}, Citations found: ${citationsArray.length}`);
            
            return response.content || 'No response from Search Capability';

        } catch (error) {
            console.error('❌ Error delegating to Search Capability:', error);
            return JSON.stringify({
                status: 'error',
                message: `Error in Search Capability: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
        }
    }

    // Method to add new specialized capabilitys in the future
    addCapability(capabilityName: string, _description: string, _functionSchema: any, _handler: Function): void {
        console.log(`🔧 Adding new capability: ${capabilityName}`);
    }
}