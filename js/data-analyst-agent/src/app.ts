import { TurnState } from "@microsoft/teams-ai";
import { Application } from "@microsoft/teams-ai";
import { MemoryStorage, TurnContext } from "botbuilder";

import { ActivityTypes } from "botbuilder";
import { DataAnalyst, DataAnalystResponse } from "./agents/data-analyst";
import { createLogger } from './core/logging';

interface ConversationState {
    count: number;
}
type ApplicationTurnState = TurnState<ConversationState>;

// Define storage and application
const storage = new MemoryStorage();
export const app = new Application<ApplicationTurnState>({
    storage
});

const dataAnalyst = DataAnalyst();
const log = createLogger('app');

// Listen for user to say '/reset' and then delete conversation state
app.message('/reset', async (context: TurnContext, state: ApplicationTurnState) => {
    state.deleteConversationState();
    await context.sendActivity(`Ok I've deleted the current conversation state.`);
});

// Listen for ANY message to be received. MUST BE AFTER ANY OTHER MESSAGE HANDLERS
app.activity(ActivityTypes.Message, async (context: TurnContext, _: ApplicationTurnState) => {
    // // Increment count state
    // let count = state.conversation.count ?? 0;
    // state.conversation.count = ++count;

    // // Echo back users request
    // await context.sendActivity(`[${count}] you said: ${context.activity.text}`);
    const response: DataAnalystResponse = await dataAnalyst.chat(context.activity.text);
    log.info(`Data Analyst Response: ${JSON.stringify(response, null, 2)}`);
    
    // Send each content item individually.
    for (const item of response) {
        if (item.text) {
            await context.sendActivity(item.text);
        }

        if (item.card) {
            await context.sendActivity({
                type: ActivityTypes.Message,
                attachments: [{
                    contentType: 'application/vnd.microsoft.card.adaptive',
                    content: item.card
                }]
            });
        }
    }
});