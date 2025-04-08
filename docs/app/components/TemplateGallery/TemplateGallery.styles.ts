'use client';

import { makeStyles, tokens } from '@fluentui/react-components';

export default makeStyles({
  root: {
    padding: tokens.spacingHorizontalXXL,
  },
  container: {
    display: 'flex',
    flexDirection: 'column',
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
    display: 'flex',
    justifyContent: 'flex-start',
    width: '100%',
  },
  searchInput: {
    width: '50%',
    maxWidth: '500px',
    borderRadius: tokens.borderRadiusLarge,
    border: `1px solid ${tokens.colorNeutralStroke1}`
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
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
    gap: tokens.spacingHorizontalL,
    alignItems: 'start',
    justifyItems: 'start',
    '& > *:first-child': {
      gridColumn: '1',
      gridRow: '1',
      maxWidth: '330px',
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
