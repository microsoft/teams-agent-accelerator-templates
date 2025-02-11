# Web Browsing Agent for Microsoft Teams

This sample demonstrates how to build an AI-powered web browsing agent that can be integrated into Microsoft Teams. The agent can perform web browsing tasks on behalf of users, providing real-time visual feedback and interactive responses. It uses [Browser-Use](https://github.com/Browser-Use/Browser-Use) to navigate the web.

## Features

- 🌐 **Autonomous Web Navigation**: Uses AI to understand and execute web browsing tasks
- 📸 **Real-time Visual Feedback**: Shows screenshots of browsing progress via adaptive cards in Adaptive Cards
- 🔄 **Interruptable**: Allows users to stop the browsing session at any time
- 🚢 **Dockerized**: Docker file ready to be deployed to an Azure App Service

## Running the sample

### Prerequisites

- [Teams Toolkit CLI](https://learn.microsoft.com/en-us/microsoftteams/platform/toolkit/teams-toolkit-cli?pivots=version-three#get-started)
- [uv](https://docs.astral.sh/uv/getting-started/installation/)
- Open AI or Azure Open AI keys

### Instructions

1. Run `uv sync` in this folder.
2. Activate the virtual environment (run `source .venv/bin/activate` in the root folder or `.venv\Scripts\activate` in the root folder if on Windows)
3. Run `playwright install` to install the browser
4. Copy the samples.env file and rename it to .env
5. Update the .env file with your own values. You only really need to update either Azure Open AI or Open AI values.
6. Use [Teams-Toolkit](https://github.com/Office-Dev/Teams-Toolkit) to run the app locally - Check out [these](https://github.com/microsoft/teams-ai/tree/main/python/samples#appendix) on how to run the sample using teams-toolkit.

### Using the agent

1. Open a 1:1 chat with the agent or include it in a group chat.
2. Send the agent a query, e.g. "What is the weather in Tokyo?" or "What are the latest headlines?"
3. The agent will navigate to the web, take screenshots and display them in adaptive cards.
4. Once the agent finishes, it will display the results in a different adaptive card.

### Using Docker

There is a [Dockerfile](Dockerfile) in the root of this repo. You can use this to build a container and deploy it to Azure App Service or a local Docker container. The azure.bicep files have been updated to use Azure Container Registry.

#### Run app in Docker locally

If you want to avoid downloading playwright dependencies, you can run the app in Docker locally. As expected, this requires you to have Docker installed. You'll also need to have Teams Toolkit installed which will help us with the provisioning and deployment of the bot.
Teams Toolkit isn't built to run Docker, so we'll need to do this manually. Roughly, this translates to the following steps:

1. Provision the bot manually (if you've already done this using Teams Toolkit, then you can skip this step)
   1. Set up a devtunnel to expose the app to the internet (See [Setting up dev tunnels](#setting-up-dev-tunnels) for more details)
   2. Run the tunnel with `devtunnel host <tunnel-name>`
   3. Go to `.env.local` and set the `BOT_ENDPOINT` to the URL of your tunnel, and `BOT_DOMAIN` to the domain of your tunnel (without the https://).
   4. Provision the bot by either:
   - Running `teamsapp provision --env=local`, or
   - Using the Teams Toolkit extension
   7. Deploy the bot by either:
   - Running `teamsapp deploy --env=local`, or
   - Using the Teams Toolkit extension
2. Build the Docker image
   - Run `docker build -t web-browsing-agent .`
3. Run the Docker container
   - Run `docker run -p 3978:3978 --env-file .env web-browsing-agent`
4. Now build the app package (`teamsapp package --env local`) This will show up in the `appPackage` folder
5. Now upload the app package to Teams. See [instructions](https://learn.microsoft.com/en-us/microsoftteams/platform/concepts/deploy-and-publish/apps-upload)

---

## Appendix

#### Setting up dev tunnels

1. Make sure [devtunnel](https://github.com/microsoft/devtunnel) is installed.
2. Run `devtunnel create <tunnel-name>` to create a new tunnel.
3. Run `devtunnel port create <tunnel-name> -p <port-number>` to create a new port for the tunnel.
4. Run `devtunnel access create <tunnel-name> -p <port-number> --anonymous` to set up anonymous access to the tunnel.
