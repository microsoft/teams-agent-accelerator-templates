import { MessageActivity } from '@microsoft/spark.api';
import { Capability } from '../base';

export class SummarizationCapability implements Capability {
  id = 'summarization';
  name = 'Summarization';
  description = 'Summarizes conversation or text content';
  keywords = ['summarize', 'summary', 'tldr'];

  async handleMessage(message: MessageActivity): Promise<MessageActivity | null> {
    // For now, return a simple response
    // In a real implementation, this would use an LLM or other service to generate summaries
    return new MessageActivity(
      `I noticed you asked for a summary. In the future, I'll be able to summarize content for you!`
    );
  }
}
