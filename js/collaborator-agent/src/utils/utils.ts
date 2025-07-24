import { MessageActivity, CitationAppearance } from '@microsoft/teams.api';
import * as chrono from 'chrono-node';

/**
 * Helper function to get formatted current date and time
 */
export function getCurrentDateTime(): string {
    const currentDate = new Date();
    const currentDayOfWeek = currentDate.toLocaleDateString('en-US', { weekday: 'long' }); // e.g., "Monday"
    return `${currentDate} (${currentDayOfWeek})`;
}

/**
 * Helper function to finalize and send a prompt response with citations
 */
export async function finalizePromptResponse(send: any, text: string, citations?: CitationAppearance[]): Promise<string> {
    const messageActivity = new MessageActivity(text)
        .addAiGenerated()
        .addFeedback();

    // Add citations if provided
    if (citations && citations.length > 0) {
        console.log(`Adding ${citations.length} citations to message activity`);
        citations.forEach((citation, index) => {
            const citationNumber = index + 1;
            messageActivity.addCitation(citationNumber, citation);
            // The corresponding citation needs to be added in the message content
            messageActivity.text += ` [${citationNumber}]`;
        });
    }

    console.log('Citations in message activity:');
    console.log(JSON.stringify(messageActivity.entities?.find(e => e.citation)?.citation, null, 2));
    const { id: sentMessageId } = await send(messageActivity);
    return sentMessageId;
}

/**
 * Calculate start and end times based on lookback period
 */
export function extractTimeRange(
  phrase: string,
  now: Date = new Date()
): { from: Date; to: Date } | null {
  const results = chrono.parse(phrase, now);
  if (!results.length || !results[0].start) {
    return null;
  }

  const { start, end } = results[0];
  const from = start.date();
  const to = end?.date() ?? new Date(from.getTime() + 24 * 60 * 60 * 1000); // +1 day

  return { from, to };
}

