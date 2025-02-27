import { App, HttpPlugin } from "@teams.sdk/apps";
import { DevtoolsPlugin } from "@teams.sdk/dev";
import { prompt } from "./agent";
const app = new App({
  plugins: [new HttpPlugin(), new DevtoolsPlugin()],
});

app.on("message", async ({ send, activity }) => {
  await send({ type: "typing" });
  const res = await prompt.chat(activity.text);
  await send(res);
});

(async () => {
  await app.start(+(process.env.PORT || 3000));
})();
