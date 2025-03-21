'use client';

import { makeStyles, tokens } from '@fluentui/react-components';

export default makeStyles({
  backdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusLarge,
    maxWidth: '90vw',
    maxHeight: '90vh',
    overflowY: 'auto',
    overflowX: 'hidden',
    position: 'relative',
  },
});
