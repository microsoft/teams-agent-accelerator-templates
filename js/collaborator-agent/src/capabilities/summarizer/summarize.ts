import { ChatPrompt } from '@microsoft/teams.ai';
import { OpenAIChatModel } from '@microsoft/teams.openai';
import { SUMMARY_PROMPT } from './prompt';
import { BaseCapability, CapabilityDefinition } from '../capability';
import { MessageContext } from '../../utils/messageContext';

export class SummarizerCapability extends BaseCapability {
  readonly name = 'summarizer';

  createPrompt(context: MessageContext): ChatPrompt {
   

    this.logInit(context);

    const summarizerModelConfig = this.getModelConfig('summarizer');

    const prompt = new ChatPrompt({
      instructions: SUMMARY_PROMPT,
      model: new OpenAIChatModel({
        model: summarizerModelConfig.model,
        apiKey: summarizerModelConfig.apiKey,
        endpoint: summarizerModelConfig.endpoint,
        apiVersion: summarizerModelConfig.apiVersion,
      }),
    })
      .function('summarize_conversation', 'Summarize the conversation history',
        async () => {
          const allMessages = context.memory.getMessagesByTimeRange(context.startTime, context.endTime);
          return JSON.stringify({
            messages: allMessages.map((msg: any) => ({
              timestamp: msg.timestamp,
              name: msg.name,
              content: msg.content
            }))
          });
        }
      );
    return prompt;
  }
}

// Capability definition for manager registration
export const SUMMARIZER_CAPABILITY_DEFINITION: CapabilityDefinition = {
  name: 'summarizer',
  manager_desc: `**Summarizer**: Use for keywords like:
- "summarize", "overview", "recap", "conversation history"
- "what did we discuss", "catch me up", "who said what", "recent messages"`,
  handler: async (context: MessageContext) => {
    const summarizerCapability = new SummarizerCapability();
    const result = await summarizerCapability.processRequest(context);
    if (result.error) {
      return `Error in Summarizer Capability: ${result.error}`;
    }
    return result.response || 'No response from Summarizer Capability';
  }
};
