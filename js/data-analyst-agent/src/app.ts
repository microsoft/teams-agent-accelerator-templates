import { Application, TurnState, StreamingResponse, FeedbackLoopData } from "@microsoft/teams-ai";
import { MemoryStorage, TurnContext } from "botbuilder";

import { ActivityTypes } from "botbuilder";
import { DataAnalyst, DataAnalystResponse } from "./agents/data-analyst";
import { createLogger } from "./core/logging";
interface ConversationState {
    count: number;
}
type ApplicationTurnState = TurnState<ConversationState>;

// Define storage and application
const storage = new MemoryStorage();
export const app = new Application<ApplicationTurnState>({
    storage
});

const log = createLogger('app');

export type ProcessingState = 
  | 'PROCESSING_MESSAGE'
  | 'PLANNING_QUERY'
  | 'FETCHING_DATA'
  | 'GENERATING_VISUALIZATION'

// Listen for user to say '/reset' and then delete conversation state
app.message('/reset', async (context: TurnContext, state: ApplicationTurnState) => {
    state.deleteConversationState();
    await context.sendActivity(`Ok I've deleted the current conversation state.`);
});

const onProgressFn = (streamer: StreamingResponse) => (update: ProcessingState) => {
    const progressMessages = {
        'PROCESSING_MESSAGE': "Processing...",
        'PLANNING_QUERY': "Planning query...", 
        'FETCHING_DATA': "Fetching data...",
        'GENERATING_VISUALIZATION': "Generating visualization..."
    };

    streamer.queueInformativeUpdate(progressMessages[update]);
}


// // Listen for ANY message to be received. MUST BE AFTER ANY OTHER MESSAGE HANDLERS
app.activity(ActivityTypes.Message, async (context: TurnContext, _: ApplicationTurnState) => {
    log.trace(`Incoming Message Activity.`)
    const streamer = new StreamingResponse(context);
    streamer.setGeneratedByAILabel(true);
    streamer.setFeedbackLoop(true);
    streamer.setFeedbackLoopType('default');

    const onProgress = onProgressFn(streamer);

    const dataAnalyst = DataAnalyst({ onProgress });

    let response: DataAnalystResponse = await dataAnalyst.chat(context.activity.text);

    const firstItem = response[0];
    let initialText = "Here's what I was able to come up with:";
    if (firstItem.text) {
        initialText = firstItem.text;
        response = response.slice(1);
    } else if (firstItem.card) {
        initialText = "Here are the visualizations I was able to create:";
    }

    await streamer.queueTextChunk(initialText);
    await streamer.waitForQueue();
    await streamer.endStream();

    // Send each content item individually.
    for (const item of response) {
        if (item.text) {
            await context.sendActivity(item.text);
        }

        if (item.card) {
            try {
                await context.sendActivity({
                    type: ActivityTypes.Message,
                    attachments: [{
                    contentType: 'application/vnd.microsoft.card.adaptive',
                        content: item.card
                    }]
                });
            } catch (error) {
                log.error(`Error sending adaptive card: ${error}`);
                await context.sendActivity(`I'm sorry, I was unable to generate a valid visualization. Please try again.`);
            }
        }
    }
});

app.feedbackLoop(async (_context: TurnContext, _state: TurnState, feedbackLoopData: FeedbackLoopData) => {
    log.trace(`Incoming Feedback Loop Activity.`)
    if (feedbackLoopData.actionValue.reaction === 'like') {
        log.info('👍');
        log.info(`Feedback: ${JSON.stringify(feedbackLoopData.actionValue.feedback, null, 2)}`);
    } else {
        log.info('👎');
        log.info(`Feedback: ${JSON.stringify(feedbackLoopData.actionValue.feedback, null, 2)}`);
    }
});