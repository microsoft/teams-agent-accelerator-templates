'use client';

import { makeStyles, tokens } from '@fluentui/react-components';

export default makeStyles({
  nav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalXXL}`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    textDecoration: 'none',
    color: tokens.colorNeutralForeground1,
  },
  logoText: {
    fontSize: tokens.fontSizeBase500,
    fontWeight: tokens.fontWeightSemibold,
    '@media (max-width: 500px)': {
      fontSize: tokens.fontSizeBase300,
    },
  },
  navLinks: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalL,
  },
  link: {
    color: tokens.colorNeutralForeground3,
    textDecoration: 'none',
    fontSize: tokens.fontSizeBase300,
    ':hover': {
      color: tokens.colorNeutralForeground1,
    },
    '@media (max-width: 500px)': {
      fontSize: tokens.fontSizeBase200,
      display: 'none',
    },
  },
  iconLink: {
    color: tokens.colorNeutralForeground3,
    display: 'flex',
    alignItems: 'center',
    textDecoration: 'none',
    ':hover': {
      color: tokens.colorNeutralForeground1,
    },
  },
  icon: {
    fontSize: '20px',
  },
});
