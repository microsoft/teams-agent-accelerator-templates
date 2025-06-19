import { App } from '@microsoft/teams.apps';
import { ConsoleLogger } from '@microsoft/teams.common';
import { DevtoolsPlugin } from '@microsoft/teams.dev';
import { dataAnalystPrompt } from './prompt';
import { shared } from './utils';
import { MessageActivity } from '@microsoft/teams.api';

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
    const res = await dataAnalystPrompt.send(activity.text, {
        onChunk: (chunk) => {
            stream.emit(chunk);
        }
    }
    );

    const cards = new MessageActivity().addAiGenerated();
    if (shared.attachments.length > 0) {
        cards.addAttachments(...shared.attachments);
        shared.attachments = [];
    }

    if (activity.conversation.isGroup) {
        if (res.content) {
            cards.addText(res.content);
        }
        await send(activity);
    } else {
        stream.emit(cards);
    }
});

(async () => {
    await app.start(+(process.env.PORT || 3000));
})();