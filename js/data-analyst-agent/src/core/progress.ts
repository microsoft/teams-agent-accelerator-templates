import { StreamingResponse } from "@microsoft/teams-ai";

export type ProcessingState = 
  | 'PROCESSING_MESSAGE'
  | 'PLANNING_QUERY'
  | 'FETCHING_DATA'
  | 'GENERATING_VISUALIZATION'

export class ProgressUpdate {
    private streamer?: StreamingResponse;

    setStreamer(streamer: StreamingResponse) {
        this.streamer = streamer;
    }

    endProgressUpdate() {
        this.streamer = undefined;
    }

    update(update: ProcessingState) {
        if (this.streamer) {
            const progressMessages = {
                'PROCESSING_MESSAGE': "Processing...",
                'PLANNING_QUERY': "Planning query...", 
                'FETCHING_DATA': "Fetching data...",
                'GENERATING_VISUALIZATION': "Generating visualization..."
            };
            this.streamer.queueInformativeUpdate(progressMessages[update]);
        }
    }

}