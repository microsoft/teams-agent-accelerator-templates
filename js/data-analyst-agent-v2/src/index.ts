import { App } from '@microsoft/teams.apps';
import { ConsoleLogger } from '@microsoft/teams.common';
import { DevtoolsPlugin } from '@microsoft/teams.dev';
import { dataAnalystPrompt } from './prompt';

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
    await dataAnalystPrompt.send(activity.text);
});

(async () => {
    await app.start(+(process.env.PORT || 3000));
})();