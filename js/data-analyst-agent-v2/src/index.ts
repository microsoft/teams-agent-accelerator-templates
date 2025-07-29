import { App } from '@microsoft/teams.apps';
import { ConsoleLogger } from '@microsoft/teams.common';
import { DevtoolsPlugin } from '@microsoft/teams.dev';
import { createDataAnalystPrompt } from './prompt';
import { MessageActivity } from '@microsoft/teams.api';
import { Message } from '@microsoft/teams.ai';

const conversationHistories = new Map<string, Message[]>();

const app = new App({
    logger: new ConsoleLogger('adventureworks-data-analyst', { level: 'debug' }),
    plugins: [new DevtoolsPlugin()],
});

app.on('install.add', async ({ send }) => {
    await send(
        "👋 Hi! I'm your Data Analyst Agent. Ask me about your data and I'll help you explore it with SQL and visualizations!"
    );
});

app.on('message', async ({ send, activity, stream }) => {
    await send({ type: 'typing' });

    const conversationId = activity.conversation.id;

    let conversationHistory = conversationHistories.get(conversationId);
    if (!conversationHistory) {
        conversationHistory = [];
        conversationHistories.set(conversationId, conversationHistory);
    }

    const { prompt, attachments } = createDataAnalystPrompt(conversationHistory);

    const res = activity.conversation.isGroup
        ? await prompt.send(activity.text)
        : await prompt.send(activity.text, {
            onChunk: (chunk: any) => {
                stream.emit(chunk);
            }
        });

    const cards = new MessageActivity().addAiGenerated();
    if (attachments.length > 0) {
        cards.addAttachments(...attachments);
    }

    if (activity.conversation.isGroup) {
        if (res.content) cards.addText(res.content);
        await send(cards);
    } else {
        stream.emit(cards);
    }
});

(async () => {
    await app.start(+(process.env.PORT || 3000));
})();