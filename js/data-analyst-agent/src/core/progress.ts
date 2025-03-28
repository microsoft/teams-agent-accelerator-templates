import { StreamingResponse } from '@microsoft/teams-ai';

export type ProcessingState = 'PROCESSING_MESSAGE' | 'FETCHING_DATA';

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
                PROCESSING_MESSAGE: 'Processing...',
                FETCHING_DATA: 'Fetching data...',
            };
            this.streamer.queueInformativeUpdate(progressMessages[update]);
        }
    }
}
