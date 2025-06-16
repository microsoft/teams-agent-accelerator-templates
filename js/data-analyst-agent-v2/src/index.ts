import { App } from '@microsoft/teams.apps';
import { ConsoleLogger } from '@microsoft/teams.common';
import { DevtoolsPlugin } from '@microsoft/teams.dev';
import { prompt } from './prompt';
import { generateChartCard } from './cards';
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

app.on('message', async ({ send, activity }) => {
    await send({ type: 'typing' });
    const res = await prompt.send(activity.text);
    console.log('Response from prompt:', res);

    let resObj: any = res;
    if (typeof res.content === 'string') {
        try {
            resObj = JSON.parse(res.content);
        } catch {
            await send({ type: 'message', text: res.content });
            return;
        }
    }

    const parseable = resObj.parseable?.[0];
    if (parseable && parseable.shouldChart) {
        const card = generateChartCard(
            { columns: parseable.columns, rows: parseable.rows },
            parseable.chartType,
            parseable.options
        );
        const chartAndInsightsMsg = new MessageActivity(resObj.text || '').addAiGenerated();
        chartAndInsightsMsg.attachments = [{
            contentType: 'application/vnd.microsoft.card.adaptive',
            content: card 
        }];
        await send(chartAndInsightsMsg);
    } else {
        const messageActivity = new MessageActivity(
            resObj.text || (typeof res.content === 'string' ? res.content : 'No chart or text response available.')
        ).addAiGenerated();
        await send(messageActivity);
    }
});

(async () => {
    await app.start(+(process.env.PORT || 3000));
})();