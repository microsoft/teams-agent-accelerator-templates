'use client';

import { makeStyles, tokens } from '@fluentui/react-components';

export default makeStyles({
  card: {
    maxWidth: '330px',
    minWidth: '150px',
    height: '360px',
    cursor: 'pointer',
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusLarge,
    transition: 'all 0.2s ease-in-out',
    display: 'flex',
    flexDirection: 'column',
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground2,
    },
    boxShadow: 'none',
    border: `1px solid ${tokens.colorNeutralStroke1}`,
  },
  preview: {
    height: '170px',
    backgroundColor: tokens.colorNeutralBackground3,
    borderTopLeftRadius: tokens.borderRadiusLarge,
    borderTopRightRadius: tokens.borderRadiusLarge,
    flexShrink: 0,
  },
  previewImage: {
    objectFit: 'cover',
    flexShrink: 0,
  },
  content: {
    position: 'relative',
    padding: tokens.spacingVerticalS + ' ' + tokens.spacingHorizontalM,
    height: '160px',
    display: 'flex',
    flexDirection: 'column',
  },
  title: {
    fontSize: tokens.fontSizeBase400,
    fontWeight: tokens.fontWeightBold,
    color: tokens.colorNeutralForeground1,
    lineHeight: tokens.lineHeightBase300,
  },
  description: {
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground2,
    lineHeight: tokens.lineHeightBase200,
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: 2,
    textOverflow: 'ellipsis',
    maxHeight: `calc(${tokens.lineHeightBase200} * 2)`,
    marginTop: tokens.spacingVerticalM,
  },
  tags: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    marginTop: tokens.spacingVerticalM,
  },
  tag: {
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground2,
    backgroundColor: tokens.colorNeutralBackground3,
    padding: `${tokens.spacingVerticalXXS} ${tokens.spacingHorizontalS}`,
    borderRadius: tokens.borderRadiusMedium,
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: 1,
    textOverflow: 'ellipsis',
  },
  footer: {
    position: 'absolute',
    bottom: tokens.spacingVerticalS,
    left: tokens.spacingHorizontalM,
    right: tokens.spacingHorizontalM,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  author: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
  },
  authorText: {
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground3,
  },
  language: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
  },
  languageDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
  languageText: {
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground3,
  },
});
