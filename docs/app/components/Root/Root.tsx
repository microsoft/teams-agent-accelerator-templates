'use client';

import { makeStyles, tokens } from '@fluentui/react-components';

const useStyles = makeStyles({
  root: {
    padding: tokens.spacingHorizontalXXL,
    maxWidth: '1400px',
    margin: '0 auto',
  },
});

function Root({ children }: { children: React.ReactNode }) {
  const classes = useStyles();

  return (
    <main>
      <div className={classes.root}>{children}</div>
    </main>
  );
}

Root.displayName = 'Root';
export default Root;
