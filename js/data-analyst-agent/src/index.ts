import { App, HttpPlugin } from '@teams.sdk/apps';
import { DevtoolsPlugin } from '@teams.sdk/dev';
import { ConsoleLogger } from '@teams.sdk/common';
import { DataAnalyst, DataAnalystResponse } from './data-analyst';

const app = new App({
    plugins: [new DevtoolsPlugin(), new HttpPlugin()],
    clientId: process.env.BOT_ID,
    clientSecret: process.env.BOT_PASSWORD,
    logger: new ConsoleLogger('data-analyst-agent', { level: 'debug' }),
});

const dataAnalyst = DataAnalyst();

app.on('message', async ({ send, activity }) => {
    await send({ type: 'typing' });

    const response: DataAnalystResponse = await dataAnalyst.chat(activity.text);

    // Send each content item individually.
    for (const item of response) {
        if (item.text) {
            await send({
                type: 'message',
                text: item.text,
            });
        }

        if (item.card) {
            await send(item.card);
        }
    }
});

(async () => {
    await app.start(3978);
})();
