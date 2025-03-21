'use client';

import { makeStyles } from '@fluentui/react-components';
import { tokens } from '@fluentui/react-components';
export default makeStyles({
  root: {
    margin: 0,
    padding: 0,
  },
  main: {
    minHeight: '100vh',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: tokens.colorNeutralBackground1,
    height: '100%',
  },
});
