'use client';

import { FC } from 'react';
import { Button, Text } from '@fluentui/react-components';
import useStyles from './Footer.styles';

const Footer: FC = () => {
  const classes = useStyles();

  const handleRequestClick = () => {
    window.open('https://github.com/microsoft/teams-agent-accelerator-templates/issues/new?template=new-template-request.md', '_blank');
  };

  const handleBuildClick = () => {
    window.open('https://learn.microsoft.com/microsoftteams/platform/agents-in-teams/overview', '_blank');
  };

  return (
    <div className={classes.footer}>
      <div className={classes.requestSection}>
        <Text className={classes.requestText}>
          Don&apos;t see what you&apos;re looking for?
        </Text>
        <div className={classes.buttonContainer}>
          <Button
            onClick={handleRequestClick}
            appearance='outline'
            aria-label="Request a new template"
            size='small'
            className={classes.requestButton}
          >
            🧩 Request a template
          </Button>
          <Text className={classes.requestText}>or</Text>
          <Button
            onClick={handleBuildClick}
            appearance='outline'
            aria-label="Build your own agent"
            size='small'
            className={classes.requestButton}
          >
            🛠️ Build Your Own Agent
          </Button>
        </div>
      </div>
    </div>
  );
};

Footer.displayName = 'Footer';

export default Footer; 
