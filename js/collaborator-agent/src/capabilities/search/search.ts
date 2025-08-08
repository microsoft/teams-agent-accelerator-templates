import { ChatPrompt } from '@microsoft/teams.ai';
import { OpenAIChatModel } from '@microsoft/teams.openai';
import { CitationAppearance } from '@microsoft/teams.api';
import { BaseCapability, CapabilityDefinition } from '../capability';
import { MessageContext } from '../../utils/messageContext';
import { MessageRecord } from '../../storage/storage';
import { SEARCH_PROMPT } from './prompt';
import { SEARCH_MESSAGES_SCHEMA } from './schema';

export class SearchCapability extends BaseCapability {
  readonly name = 'search';

  createPrompt(context: MessageContext): ChatPrompt {
    const searchModelConfig = this.getModelConfig('search');

    const prompt = new ChatPrompt({
      instructions: SEARCH_PROMPT,
      model: new OpenAIChatModel({
        model: searchModelConfig.model,
        apiKey: searchModelConfig.apiKey,
        endpoint: searchModelConfig.endpoint,
        apiVersion: searchModelConfig.apiVersion,
      }),
    }).function('search_messages', 'Search the conversation for relevant messages', SEARCH_MESSAGES_SCHEMA,
      async (args: any) => {
        const { keywords = [], participants = [], max_results = 5 } = args;

        const messages = context.memory.getMessagesByTimeRange(context.startTime, context.endTime);

        const keywordFiltered = messages.filter(msg =>
          keywords.some((kw: string) => msg.content.toLowerCase().includes(kw.toLowerCase()))
        );

        const participantFiltered = participants.length > 0
          ? keywordFiltered.filter(msg =>
            participants.some((p: string) =>
              msg.name.toLowerCase().includes(p.toLowerCase()) ||
              p.toLowerCase().includes(msg.name.toLowerCase())
            )
          )
          : keywordFiltered;

        const sorted = participantFiltered.sort((a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        const selected = sorted.slice(0, max_results);

        if (selected.length === 0) {
          return 'No matching messages found.';
        }

        // Create and store citations
        const citations = selected.map(msg => createCitationFromRecord(msg, context.conversationId));
        context.citations.push(...citations);

        // Return formatted message list with links
        return selected.map(msg => {
          const date = new Date(msg.timestamp).toLocaleString();
          const preview = msg.content.slice(0, 100);
          const citation = citations.find(c => c.keywords?.includes(msg.name));
          const link = citation?.url || '#';
          return `• [${msg.name}](${link}) at ${date}: "${preview}"`;
        }).join('\n');
      });

    return prompt;
  }
}

function createDeepLink(activityId: string, conversationId: string): string {
  const contextParam = encodeURIComponent(JSON.stringify({ contextType: 'chat' }));
  return `https://teams.microsoft.com/l/message/${encodeURIComponent(conversationId)}/${activityId}?context=${contextParam}`;
}

function createCitationFromRecord(message: MessageRecord, conversationId: string): CitationAppearance {
  const date = new Date(message.timestamp);
  const formatted = date.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
  });
  const preview = message.content.length > 120 ? message.content.slice(0, 120) + '...' : message.content;
  const deepLink = createDeepLink(message.activity_id!, conversationId);

  return {
    name: `Message from ${message.name}`,
    url: deepLink,
    abstract: `${formatted}: "${preview}"`,
    keywords: [message.name]
  };
}

// Capability definition for manager registration
export const SEARCH_CAPABILITY_DEFINITION: CapabilityDefinition = {
  name: 'search',
  manager_desc: `**Search**: Use for:
- "find", "search", "show me", "conversation with", "where did [person] say", "messages from last week"`,
  handler: async (context: MessageContext) => {
    const searchCapability = new SearchCapability();
    const result = await searchCapability.processRequest(context);
    if (result.error) {
      console.error(`❌ Error in Summarizer Capability: ${result.error}`);
      return `Error in Summarizer Capability: ${result.error}`;
    }
    return result.response || 'No response from Search Capability';
  }
};