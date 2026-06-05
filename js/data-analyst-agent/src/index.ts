import { App } from '@microsoft/teams.apps';
import { ConsoleLogger } from '@microsoft/teams.common';
import { MessageActivity } from '@microsoft/teams.api';

import { DataAnalyst, DataAnalystResponse } from './data-analyst';
import { createLogger } from './core/logging';
import { ProgressUpdate } from './core/progress';

const app = new App({
    logger: new ConsoleLogger('data-analyst-agent', { level: 'debug' }),
});

const log = createLogger('app');

const progressUpdate = new ProgressUpdate();
let dataAnalyst = DataAnalyst({ progressUpdate });

app.on('install.add', async ({ send }) => {
    await send("Hi! I'm your Data Analyst Agent. Ask me about your data and I'll help you explore it with SQL and visualizations!");
});

app.on('message', async ({ send, activity, stream }) => {
    const text = activity.text;
    if (!text) return;

    // Handle reset command
    if (text.trim() === '/reset') {
        dataAnalyst = DataAnalyst({ progressUpdate });
        await send('Resetting agent...');
        return;
    }

    log.trace('Incoming Message Activity.');

    if (!activity.conversation.isGroup) {
        await streamingDataAnalyst(text, stream);
    } else {
        await nonStreamingDataAnalyst(text, send);
    }
});

app.on('message.submit.feedback', async ({ activity }) => {
    log.trace('Incoming Feedback Loop Activity.');
    const actionValue = activity.value?.actionValue;
    if (actionValue?.reaction === 'like') {
        log.info('👍');
    } else {
        log.info('👎');
    }
    if (actionValue?.feedback) {
        log.info(`Feedback: ${actionValue.feedback}`);
    }
});

async function streamingDataAnalyst(text: string, stream: any) {
    progressUpdate.setStreamer(stream);

    const response: DataAnalystResponse = await dataAnalyst.chat(text);
    progressUpdate.endProgressUpdate();

    const attachments: any[] = [];
    for (const item of response) {
        if (item.text) {
            stream.emit(item.text + '\n\n');
        }
        if (item.card) {
            attachments.push({
                contentType: 'application/vnd.microsoft.card.adaptive',
                content: item.card,
            });
        }
    }

    if (attachments.length > 0) {
        const resultMessage = new MessageActivity().addAiGenerated().addAttachments(...attachments);
        stream.emit(resultMessage);
    } else {
        // Close stream with AI generated label
        stream.emit(new MessageActivity().addAiGenerated());
    }
}

async function nonStreamingDataAnalyst(text: string, send: any) {
    const sent = await send('Working on it...');

    try {
        const response: DataAnalystResponse = await dataAnalyst.chat(text);

        const attachments: any[] = [];
        let textBuffer = '';
        for (const item of response) {
            if (item.text) {
                textBuffer += item.text + '\n\n';
            }
            if (item.card) {
                attachments.push({
                    contentType: 'application/vnd.microsoft.card.adaptive',
                    content: item.card,
                });
            }
        }

        if (textBuffer.length === 0) {
            textBuffer = attachments.length > 0
                ? 'Here are the visualizations:'
                : "Sorry I wasn't able to answer your query. Please try again.";
        }

        // Update the original message with AI generated label
        const updateActivity = new MessageActivity()
            .addText(textBuffer)
            .addAiGenerated();
        updateActivity.id = sent.id;
        await send(updateActivity);

        if (attachments.length > 0) {
            const cardActivity = new MessageActivity().addAttachments(...attachments);
            await send(cardActivity);
        }
    } catch (error) {
        log.error(`Error: ${error}`);
        const errorActivity = new MessageActivity().addText(`Failure Occurred. ${error}`);
        errorActivity.id = sent.id;
        await send(errorActivity);
    }
}

(async () => {
    await app.start(+(process.env.PORT || 3978));
})();
