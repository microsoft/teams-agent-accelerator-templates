'use client';

import { Spinner as FluentSpinner } from '@fluentui/react-components';
import { makeStyles } from '@fluentui/react-components';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '200px',
  },
});

export const Spinner = () => {
  const classes = useStyles();
  return (
    <div className={classes.container}>
      <FluentSpinner size="large" />
    </div>
  );
};

export default Spinner;
