'use client';

import { makeStyles, tokens } from '@fluentui/react-components';
import { Spinner } from '@fluentui/react-components';

const useStyles = makeStyles({
  container: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: tokens.colorNeutralBackground1,
    zIndex: 9999,
  },
});

export const PageLoader = () => {
  const classes = useStyles();
  return (
    <div className={classes.container}>
      <Spinner size="large" />
    </div>
  );
};

export default PageLoader;
