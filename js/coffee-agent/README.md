<!--
---
id: coffee-agent
title: "Coffee Agent"
description: "Originally from our Build 2025 Lab - simple coffee agent demonstration."
longDescription: |
  This sample is built with the Teams AI Library v2, and showcases how easy it is to use activity handlers, adaptive cards, and AI to create a fun, interactive bot with just a few building blocks.

featuresList:
  - "☕ Randomly select a coffee shop and orderer for the day"
  - "📋 Manage and display submitted coffee orders for the team"
  - "🥤 Maintains a list of coffee shops and drinks"
  - "🕓 Provides a list of opening hours for coffee shops"
tags:
  - "tools"
  - "adaptive-cards"
  - "ai"
githubUrl: "https://github.com/microsoft/teams-agent-accelerator-samples/blob/main/js/coffee-agent"
imageUrl: "https://github.com/microsoft/teams-agent-accelerator-samples/raw/main/js/coffee-agent/assets/coffee-agent-thumbnail.png"
author: "Microsoft"
language: "JavaScript"
demoUrlGif: ""
demoYoutubeVideoId: ""
---
-->

# Coffee Agent for Microsoft Teams

Originally from our Build 2025 Lab, this sample is built with the [Teams AI Library v2](https://aka.ms/teamsai-v2), and showcases how easy it is to use activity handlers, adaptive cards, and AI to create a fun, interactive bot with just a few building blocks.

## Key Features

  - ☕ Randomly select a coffee shop and orderer for the day
  - 📋 Manage and display submitted coffee orders for the team
  - 🥤 Maintains a list of coffee shops and drinks
  - 🕓 Provides a list of opening hours for coffee shops

## Running the Sample

### Prerequisites

- [Node.js](https://nodejs.org/) version 18.x or higher
- [npm](https://www.npmjs.com/) (comes with Node.js)
- [Teams Toolkit Extension](https://marketplace.visualstudio.com/items?itemName=TeamsDevApp.ms-teams-vscode-extension) for Visual Studio Code
- [Visual Studio Code](https://code.visualstudio.com/)
- A Microsoft Teams account with the ability to upload custom apps
- OpenAI API Key or Azure OpenAI resource.

### Installation

1. Clone this repository:

    ```bash
    git clone https://github.com/microsoft/teams-agent-accelerator-templates
    cd js/coffee-agent
    ```

2. Install dependencies:
    ```bash
    npm install
    ```

### Environment Setup

1. Copy the sample environment file:

    ```bash
    cp sample.env .env
    ```

2. Update the `.env` file with your configuration:
    - `CLIENT_ID`: Your Microsoft Teams bot ID (will be automatically generated if using Teams Toolkit)
    - `CLIENT_SECRET`: Your bot's password (will be automatically generated if using Teams Toolkit)
    - Azure OpenAI or OpenAI configurations. See `sample.env` for more details.

### Running the Bot

1. Open the project in Visual Studio Code
2. Press F5 to start the debug session (Debug Edge)
3. Teams Toolkit will handle:
    - Starting the local bot server
    - Tunneling for external access
    - Opening Teams with your bot loaded
4. Upon installation, the bot will automatically send an adaptive card with your team's coffee order for today!

#### Sample Questions

You can ask the agent questions like:

- "What can you do?"
- "Who should order the coffee today?"
- "I want to add a coffee shop. Can we add the Living Room Cafe. It has two drinks, a Matcha Latte (small) and an Oat Lavender Latte (medium)."
- "Send me an updated list of coffee shops."