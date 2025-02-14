import { App, HttpPlugin } from '@teams.sdk/apps';
import { DevtoolsPlugin } from '@teams.sdk/dev';
import { ConsoleLogger } from '@teams.sdk/common';
import { DataAnalyst, DataAnalystResponse } from './data-analyst';
import { Card } from '@teams.sdk/cards';
import * as fs from 'fs';

const app = new App({
    plugins: [new DevtoolsPlugin(), new HttpPlugin()],
    clientId: process.env.BOT_ID,
    clientSecret: process.env.BOT_PASSWORD,
    logger: new ConsoleLogger('data-analyst-agent', { level: 'debug' }),
});

const dataAnalyst = DataAnalyst();

app.on('conversationUpdate', async ({ send }) => {
    const welcomeMessage = "Hello! I am a data analyst and expert on the AdventureWorks database. " +
        "AdventureWorks is a fictional global manufacturing company that produces cycling equipment and accessories.<br><br>" +
        "I can help answer your questions and queries about <b>products</b>, <b>customers</b>, and <b>sales</b>.";

    const adventureWorksImage = fs.readFileSync('assets/adventureWorks-small.png', 'base64');
    const adventureWorksCard = Card(
        [
            {
                type: 'Image',
                url: `data:image/png;base64,${adventureWorksImage}`,
            },
        ],
    );

    await send(adventureWorksCard);

    await send({
        type: 'message',
        text: welcomeMessage,
    });
});

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
