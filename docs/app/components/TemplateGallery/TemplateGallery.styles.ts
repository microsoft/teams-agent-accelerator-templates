'use client';

import { makeStyles, tokens } from '@fluentui/react-components';

export default makeStyles({
  root: {
    padding: tokens.spacingHorizontalXXL,
    paddingTop: "0",
  },
  searchSection: {
    width: '100%',
    maxWidth: '1200px',
    margin: '0 auto',
    marginBottom: `calc(${tokens.spacingVerticalXXL} * 2)`,
  },
  container: {
    display: 'flex',
    flexDirection: 'column',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  sidebar: {
    width: '240px',
    flexShrink: 0,
  },
  sidebarTitle: {
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
    marginBottom: tokens.spacingVerticalM,
  },
  searchContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    gap: tokens.spacingHorizontalL,
  },
  searchInput: {
    width: '70%',
    maxWidth: '700px',
    borderRadius: tokens.borderRadiusLarge,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    height: '64px',
    fontSize: tokens.fontSizeBase500,
    padding: `${tokens.spacingVerticalL} ${tokens.spacingHorizontalL}`,
  },
  filterSection: {
    marginBottom: tokens.spacingVerticalL,
  },
  filterTitle: {
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    marginBottom: tokens.spacingVerticalS,
  },
  list: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: tokens.spacingHorizontalXL + ' ' + tokens.spacingVerticalXL,
    alignItems: 'stretch',
    '& > *': {
      width: '100%',
      height: '100%',
    },
    '@media (max-width: 1300px)': {
      gridTemplateColumns: 'repeat(2, 1fr)',
    },
    '@media (max-width: 800px)': {
      gridTemplateColumns: '1fr',
    },
  },
  noResults: {
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '200px',
    textAlign: 'center',
    padding: tokens.spacingVerticalXXL,
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase400,
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusLarge,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
  },
});
