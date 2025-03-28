---
id: computer-use-agent
title: "Computer Use Agent"
description: "AI-powered automation of computer tasks through Teams interface."
longDescription: |
  This sample introduces an AI-powered Computer Use Agent (CUA) that integrates with Microsoft Teams to automate tasks such as booking flights, searching for products, and filling out forms. Powered by OpenAI, the agent interacts with computer interfaces—clicking, typing, scrolling, and more—while providing real-time updates through Microsoft Teams. It can handle a variety of computer-based tasks, including web browsing and terminal operations and also handle user inputs when needed.
  
  It leverages OpenAI's [Computer Use](https://platform.openai.com/docs/guides/tools-computer-use) capabilities.
  
  Check out the [LinkedIn post](https://www.linkedin.com/feed/update/urn:li:activity:7307477075148320768/) for a video of the sample in action.
featuresList:
  - "🖥️ **Computer Control:** Uses AI to understand and execute computer tasks including terminal operations and web browsing"
  - "📸 **Real-time Visual Feedback:** Shows screenshots of agent actions via adaptive cards in Teams"
  - "✨ **Responses API:** Uses the OpenAI Responses API to track the state of the agent"
  - "⏸️ **Pausable:** Allows users to pause and resume agent operations at any time"
  - "🔒 **Safety First:** Uses adaptive cards for user approval of actions if the model wants it"
  - "🌐 **Browser Mode:** Can use Playwright browser for web interactions"
  - "🐳 **Dockerized VNC:** Includes a Dockerfile that sets up a sandboxed environment with VNC enabled"
tags:
  - "computer-use"
  - "human-in-the-loop"
  - "stateful"
  - "visual-feedback"
githubUrl: "https://github.com/microsoft/teams-agent-accelerator-samples/blob/main/python/computer-use-agent"
imageUrl: "https://github.com/microsoft/teams-agent-accelerator-samples/raw/main/python/computer-use-agent/docs/cua-thumbnail.png"
author: "Microsoft"
language: "Python"
demoUrlGif: "https://github.com/microsoft/teams-agent-accelerator-samples/raw/main/python/computer-use-agent/docs/VNCExample.gif"
---

# Computer Use Agent for Microsoft Teams

This sample introduces an AI-powered Computer Use Agent (CUA) that integrates with Microsoft Teams to automate tasks such as booking flights, searching for products, and filling out forms. Powered by OpenAI, the agent interacts with computer interfaces—clicking, typing, scrolling, and more—while providing real-time updates through Microsoft Teams. It can handle a variety of computer-based tasks, including web browsing and terminal operations and also handle user inputs when needed.

It leverages OpenAI's [Computer Use](https://platform.openai.com/docs/guides/tools-computer-use) capabilities.

Check out the [LinkedIn post](https://www.linkedin.com/feed/update/urn:li:activity:7307477075148320768/) for a video of the sample in action.

## Features

- 🖥️ **Computer Control**: Uses AI to understand and execute computer tasks including terminal operations and web browsing
- 📸 **Real-time Visual Feedback**: Shows screenshots of agent actions via adaptive cards in Teams
- ✨ **Responses API**: Uses the OpenAI Responses API to track the state of the agent
- ⏸️ **Pausable**: Allows users to pause and resume agent operations at any time
- 🔒 **Safety First**: Uses adaptive cards for user approval of actions if the model wants it
- 🌐 **Browser Mode**: Can use Playwright browser for web interactions
- 🐳 **Dockerized VNC**: Includes a Dockerfile that sets up a sandboxed environment with VNC enabled

## Example

![Example](./docs/VNCExample.gif)

In this example, the agent is using a VNC connection to control a computer. The screenshots and progress and sent as adaptive cards and displayed in Teams.

## Running the sample

### Prerequisites

- [Teams Toolkit CLI](https://learn.microsoft.com/en-us/microsoftteams/platform/toolkit/teams-toolkit-cli?pivots=version-three#get-started)
- [uv](https://docs.astral.sh/uv/getting-started/installation/)
- Open AI or Azure Open AI keys
  - Make sure the model you use has computer-use capabilities
- [Docker](https://docs.docker.com/get-docker/)

### Instructions

1. Run `uv sync` in this folder.
2. Activate the virtual environment (run `source .venv/bin/activate` in the root folder or `.venv\Scripts\activate` in the root folder if on Windows)
3. Copy the samples.env file and rename it to .env
4. Update the .env file with your own values:
   - Set either Azure Open AI or Open AI credentials
     - For Azure Open AI, make sure your model has computer-use capabilities
5. Set up [Local computer](#local-computer) or [Local browser](#local-browser)
6. Use [Teams-Toolkit](https://github.com/Office-Dev/Teams-Toolkit) to run the app locally - Check out [these](https://github.com/microsoft/teams-ai/tree/main/python/samples#appendix) on how to run the sample using teams-toolkit.

### Local computer

This is the default mode for the agent. It sets up a sandboxed dockerized container with VNC enabled. Then the local agent will connect to this container and control it.

#### Setting up a VNC enabled container in Docker

There is a [Dockerfile](Dockerfile) in the root of this repo that sets up a sandboxed environment with VNC enabled. You can use this to build a container and deploy it to Azure App Service or run it locally.

#### Building and Running the Container

1. Build the Docker image:

```bash
docker build -t cua_mode_image .
```

2. Some commands for the container:

```bash
# Run the container
docker run -d --name cua_mode_container -p 5900:5900 -p 6080:6080 cua_mode_image

# Stop the container
docker stop cua_mode_container

# Restart the container
docker restart cua_mode_container

# Remove the container
docker rm cua_mode_container

# Remove the image
docker rmi cua_mode_image
```

3. By default, we have [noVNC](https://novnc.com/info.html) enabled for the container. You can access the VNC server at `http://localhost:6080/vnc.html`. Use password "secret" to login and view the desktop of your container!

### Local browser

This mode will use Playwright to open a browser and interact with it. This is not the default mode and needs to be enabled by setting `USE_BROWSER=true` in the .env file.

#### Setting up playwright

1. Run `playwright install` to install the browsers on your machine
2. Set `USE_BROWSER=true` in the .env file

### Using the agent

1. Open a 1:1 chat with the agent or include it in a group chat.
2. Send the agent a query, e.g. "What is the weather in Tokyo?" or "Create a new directory called 'test'"
3. The agent will perform the requested actions, showing screenshots and asking for approval when needed
4. You can pause the agent at any time during its operation
5. The agent will display results in adaptive cards

## Appendix

#### Setting up dev tunnels

1. Make sure [devtunnel](https://github.com/microsoft/devtunnel) is installed.
2. Run `devtunnel create <tunnel-name>` to create a new tunnel.
3. Run `devtunnel port create <tunnel-name> -p <port-number>` to create a new port for the tunnel.
4. Run `devtunnel access create <tunnel-name> -p <port-number> --anonymous` to set up anonymous access to the tunnel.
