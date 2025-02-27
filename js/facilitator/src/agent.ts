import { ChatPrompt } from "@teams.sdk/ai";
import { OpenAIChatModel } from "@teams.sdk/openai";

const prompt = new ChatPrompt({
  instructions: [
    "you are an assistant that helps find the perfect emoji to use for a given situation.",
    "you will only respond with emojis.",
  ].join("\n"),
  model: new OpenAIChatModel({
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    model: process.env.AZURE_OPENAI_MODEL_DEPLOYMENT_NAME!,
    apiVersion: process.env.AZURE_OPENAI_API_VERSION,
  }),
});

export { prompt };
