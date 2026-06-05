import { IStreamer } from '@microsoft/teams.apps';

export type ProcessingState = 'PROCESSING_MESSAGE' | 'FETCHING_DATA';

export class ProgressUpdate {
    private streamer?: IStreamer;

    setStreamer(streamer: IStreamer) {
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
            this.streamer.update(progressMessages[update]);
        }
    }
}
