import { App, HttpPlugin } from '@teams.sdk/apps';
import { DevtoolsPlugin } from '@teams.sdk/dev';
import { Message } from '@teams.sdk/ai';
import { LocalStorage } from '@teams.sdk/common/storage';
import { ConsoleLogger } from '@teams.sdk/common';
import { DataAnalyst } from './data-analyst';

const storage = new LocalStorage<{
  messages: Message[];
}>();

const app = new App({
  plugins: [new DevtoolsPlugin(), new HttpPlugin()],
  clientId: process.env.BOT_ID,
  clientSecret: process.env.BOT_PASSWORD,
  logger: new ConsoleLogger("data-analyst-agent", { level: "debug" }),
});

app.on('message', async ({ send, activity }) => {
  let state = storage.get(activity.from.id);

  if (!state) {
    state = {
      messages: [],
    };

    storage.set(activity.from.id, state);
  }

  if (activity.text === '/history') {
    await send({
      type: 'message',
      text: state.messages.map((m) => `- ${m.role}: ${JSON.stringify(m.content)}`).join('\n'),
    });

    return;
  }
  
  await send({ type: 'typing' });
  
  const dataAnalyst = DataAnalyst({send});
  await dataAnalyst.chat(activity.text);

  // await send({
  //   type: 'message',
  //   text: response,
  // });

  // // Use streaming to send chunks of the response as they arrive
  // await prompt.chat(activity.text, async (chunk: string) => {
  //   // console.log(chunk);
  //   // // await stream.emit({
  //   // //   type: 'message',
  //   // //   text: chunk,
  //   // //   channelData: {
  //   // //     feedbackLoopEnabled: true,
  //   // //   },
  //   // // });

  // });
});

(async () => {
  await app.start(3978);
})();
