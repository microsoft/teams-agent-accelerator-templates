'use client';

import { makeStyles, tokens } from '@fluentui/react-components';

export default makeStyles({
  header: {
    textAlign: 'center',
    maxWidth: '1200px',
    margin: `${tokens.spacingVerticalXL} auto`,
    padding: `${tokens.spacingVerticalXXL} 0`,
  },
  titleContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacingHorizontalM,
    marginBottom: tokens.spacingVerticalXXL,
  },
  title: {
    fontSize: tokens.fontSizeHero1000,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    '@media (max-width: 1100px)': {
      fontSize: tokens.fontSizeHero900,
    },
    '@media (max-width: 700px)': {
      fontSize: tokens.fontSizeBase600,
    },
  },
  titleIcon: {
    width: '40px',
    height: '40px',
  },
  subtitle: {
    fontSize: tokens.fontSizeBase600,
    color: tokens.colorNeutralForeground3,
    lineHeight: tokens.lineHeightBase500,
    maxWidth: '1200px',
    margin: '0 auto',
    '@media (max-width: 700px)': {
      fontSize: tokens.fontSizeBase400,
    },
  },
});
