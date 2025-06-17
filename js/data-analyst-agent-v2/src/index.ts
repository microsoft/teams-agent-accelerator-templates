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
    const res = await dataAnalystPrompt.send(activity.text
        // , {
        // onChunk: (chunk) => {
        //     stream.emit(chunk);
        // }}
    );

    console.log('Response:', res);
    await send({ type: 'message', text: res.content });

    if (shared.attachments.length > 0) {
        console.log('Sending attachments:', shared.attachments);
        const msgWithCards = new MessageActivity('').addAiGenerated();
        msgWithCards.attachments = shared.attachments.map(card => ({
            contentType: 'application/vnd.microsoft.card.adaptive',
            content: card,
        }));
        await send(msgWithCards);
        
        shared.attachments = [];
    }
});

(async () => {
    await app.start(+(process.env.PORT || 3000));
})();

// const chartAndInsightsMsg = new MessageActivity(resObj.text || '').addAiGenerated();
//             chartAndInsightsMsg.attachments = [{
//                 contentType: 'application/vnd.microsoft.card.adaptive',
//                 content: card
//             }];