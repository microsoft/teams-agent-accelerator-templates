'use client';

import { makeStyles, tokens } from '@fluentui/react-components';

export default makeStyles({
  footer: {
    marginTop: tokens.spacingVerticalXXL,
    padding: `${tokens.spacingVerticalXXL} 0`,
    borderTop: `1px solid ${tokens.colorNeutralStroke1}`,
  },
  requestSection: {
    maxWidth: '800px',
    margin: '0 auto',
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacingHorizontalS,
  },
  requestText: {
    fontSize: tokens.fontSizeBase400,
    color: tokens.colorNeutralForeground2,
  },
  requestButton: {
    fontSize: tokens.fontSizeBase400,
  },
  buttonContainer: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    alignItems: 'center',
  },
}); 