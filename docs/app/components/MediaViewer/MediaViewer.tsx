'use client';

import { FC } from 'react';
import YouTube from 'react-youtube';
import useStyles from './MediaViewer.styles';

interface MediaViewerProps {
  youtubeVideoId?: string;
  gifUrl?: string;
  title: string;
}

const MediaViewer: FC<MediaViewerProps> = ({ youtubeVideoId, gifUrl, title }) => {
  const classes = useStyles();

  if (youtubeVideoId) {
    return (
      <div className={classes.youtubePlayer}>
        <YouTube
          videoId={youtubeVideoId}
          opts={{
            width: '640',
            height: '390',
            playerVars: {
              autoplay: 0,
            },
          }}
          className={classes.player}
        />
      </div>
    );
  }

  if (gifUrl) {
    return (
      <img 
        src={gifUrl} 
        alt={`${title} demo GIF`} 
        className={classes.gifImage} 
      />
    );
  }

  return null;
};

MediaViewer.displayName = 'MediaViewer';
export default MediaViewer; 