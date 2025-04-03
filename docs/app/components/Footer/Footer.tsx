'use client';

import { FC } from 'react';
import { Button, Text } from '@fluentui/react-components';
import useStyles from './Footer.styles';

const Footer: FC = () => {
  const classes = useStyles();

  const handleRequestClick = () => {
    window.open('https://github.com/microsoft/teams-agent-accelerator-templates/issues/new?template=new-template-request.md', '_blank');
  };

  return (
    <div className={classes.footer}>
      <div className={classes.requestSection}>
        <Text className={classes.requestText}>
          Don&apos;t see what you&apos;re looking for?
        </Text>
        <Button
          onClick={handleRequestClick}
          appearance='outline'
          aria-label="Request a new template"
          size='small'
          className={classes.requestButton}
        >
          Request a template
        </Button>
      </div>
    </div>
  );
};

Footer.displayName = 'Footer';

export default Footer; 