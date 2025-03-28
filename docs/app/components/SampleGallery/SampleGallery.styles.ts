'use client';

import { makeStyles, tokens } from '@fluentui/react-components';

export default makeStyles({
  root: {
    padding: tokens.spacingHorizontalXXL,
  },
  container: {
    display: 'flex',
    gap: tokens.spacingHorizontalXL,
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
    marginBottom: tokens.spacingVerticalL,
  },
  filterSection: {
    marginBottom: tokens.spacingVerticalL,
  },
  filterTitle: {
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    marginBottom: tokens.spacingVerticalS,
  },
  grid: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: tokens.spacingHorizontalL,
    alignItems: 'start',
    justifyItems: 'center',
    '& > *:first-child:last-child': {
      gridColumn: '1 / -1',
      maxWidth: '330px',
      justifySelf: 'center',
    },
  },
});
