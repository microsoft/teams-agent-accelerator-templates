import { makeStyles } from '@griffel/react';

const useStyles = makeStyles({
  youtubePlayer: {
    width: '100%',
    position: 'relative',
    paddingTop: '56.25%',
    '& iframe': {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      border: 'none',
    },
  },
  gifImage: {
    display: 'block',
    maxWidth: '100%',
    maxHeight: 'calc(80vh - 100px)',
    margin: '0 auto',
  },
  player: {
    width: '100%',
    height: '100%',
  },
});

export default useStyles; 