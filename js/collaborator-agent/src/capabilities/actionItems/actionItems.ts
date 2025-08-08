import { ChatPrompt } from '@microsoft/teams.ai';
import { OpenAIChatModel } from '@microsoft/teams.openai';
import { ACTION_ITEMS_PROMPT } from './prompt';
import { BaseCapability, CapabilityDefinition } from '../capability';
import { MessageContext } from '../../utils/messageContext';

export class ActionItemsCapability extends BaseCapability {
  readonly name = 'action_items';

  createPrompt(context: MessageContext): ChatPrompt {

    this.logInit(context);

    const actionItemsModelConfig = this.getModelConfig('actionItems');

    // Use members from context
    console.log(`👥 Action Items Capability using ${context.members.length} members from context`);

    const prompt = new ChatPrompt({
      instructions: ACTION_ITEMS_PROMPT,
      model: new OpenAIChatModel({
        model: actionItemsModelConfig.model,
        apiKey: actionItemsModelConfig.apiKey,
        endpoint: actionItemsModelConfig.endpoint,
        apiVersion: actionItemsModelConfig.apiVersion,
      }),
    }).function(
      'generate_action_items',
      'Generate a list of action items based on the conversation',
      async (_args: any) => {
        const allMessages = context.memory.getMessagesByTimeRange(context.startTime, context.endTime);
        console.log(allMessages);
        console.log(context.startTime);
        console.log(context.endTime);
          return JSON.stringify({
            messages: allMessages.map((msg: any) => ({
              timestamp: msg.timestamp,
              role: msg.role,
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
export const ACTION_ITEMS_CAPABILITY_DEFINITION: CapabilityDefinition = {
  name: 'action_items',
  manager_desc: `**Action Items**: Use for requests like:
- "next steps", "to-do", "assign task", "my tasks", "what needs to be done"`,
  handler: async (context: MessageContext) => {
    const actionItemsCapability = new ActionItemsCapability();
    const result = await actionItemsCapability.processRequest(context);
    return result.response || 'No response from Action Items Capability';
  }
};
