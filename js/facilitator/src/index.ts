import { Agent } from './agent/core';
import { SummarizationCapability } from './capabilities/summarization';

const agent = new Agent();

// Register capabilities
agent.registerCapability(new SummarizationCapability());

(async () => {
  await agent.start(+(process.env.PORT || 3000));
})();
