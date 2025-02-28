import { Application, TurnState, StreamingResponse, FeedbackLoopData } from "@microsoft/teams-ai";
import { MemoryStorage, TurnContext } from "botbuilder";

import { ActivityTypes } from "botbuilder";
import { DataAnalyst, DataAnalystResponse } from "./agents/data-analyst";
import { createLogger } from "./core/logging";
import { ProgressUpdate } from "./core/progress";
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

const progressUpdate = new ProgressUpdate();
let dataAnalyst = DataAnalyst({ progressUpdate });

// Clears the conversation history of all the agents.
app.message("/reset", async (context: TurnContext, _: ApplicationTurnState) => {
    // Reset the agent
    dataAnalyst = DataAnalyst({ progressUpdate });
    await context.sendActivity(`Resetting agent...`);
});

// Listen for ANY message to be received. MUST BE AFTER ANY OTHER MESSAGE HANDLERS
app.activity(ActivityTypes.Message, async (context: TurnContext, _: ApplicationTurnState) => {
    log.trace(`Incoming Message Activity.`)

    if (isPersonalScope(context)) {
        await streamingDataAnalyst(context);
    } else {
        await nonStreamingDataAnalyst(context);
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

function isPersonalScope(context: TurnContext) {
    return context.activity.conversation?.conversationType == 'personal';
}

async function streamingDataAnalyst(context: TurnContext) {
    const streamer = new StreamingResponse(context);
    streamer.setGeneratedByAILabel(true);
    streamer.setFeedbackLoop(true);
    streamer.setFeedbackLoopType('default');

    progressUpdate.setStreamer(streamer);

    let response: DataAnalystResponse = await dataAnalyst.chat(context.activity.text);

    progressUpdate.endProgressUpdate();

    // Send each content item individually.
    const attachments = [];
    for (const item of response) {
        if (item.text) {
            const text = item.text + "\n\n";
            streamer.queueTextChunk(text);
        }

        if (item.card) {
            attachments.push({
                contentType: 'application/vnd.microsoft.card.adaptive',
                content: item.card
            });
        }
    }

    streamer.setAttachments(attachments);
    await streamer.waitForQueue();
    await streamer.endStream();
}

async function nonStreamingDataAnalyst(context: TurnContext) {
    const activity = await context.sendActivity(`Working on it...`);
    
    if (!activity) {
        log.error(`Failed to send activity`);
        return;
    }

    try {
        let response: DataAnalystResponse = await dataAnalyst.chat(context.activity.text);

        // Send each content item individually.
        const attachments = [];
        let textBuffer = ""
        for (const item of response) {
            if (item.text) {
                textBuffer += item.text + "\n\n";
            }

            if (item.card) {
                attachments.push({
                    contentType: 'application/vnd.microsoft.card.adaptive',
                    content: item.card
                });
            }
        }

        if (textBuffer.length === 0) {
            if (attachments.length > 0) {
                textBuffer = "Here are the visualizations:";
            } else {
                textBuffer = "Sorry I wasn't able to answer your query. Please try again.";
            }
        }

        // Update the original activity with the text response
        await context.updateActivity({
            id: activity.id,
            type: ActivityTypes.Message,
            text: textBuffer,
            channelData: {
                feedbackLoop: {
                    type: 'default'
                }
            },
            entities: [
                {
                    type: 'https://schema.org/Message',
                    '@type': 'Message',
                    '@context': 'https://schema.org',
                    '@id': '',
                    additionalType: ['AIGeneratedContent'],
                }
            ]
        })

        if (attachments.length > 0) {    
            // Send the Adaptive Card attachments. Teams doesn't allow multiple attachments in a single update activity, so we have to send them in a separate activity.
            await context.sendActivity({
                type: ActivityTypes.Message,
                attachments: attachments
            });
        }
    } catch (error) {
        log.error(`Error: ${error}`);
        await context.updateActivity({
            id: activity.id,
            type: ActivityTypes.Message,
            text: `Failure Occured. ${error}`
        });
    }
}