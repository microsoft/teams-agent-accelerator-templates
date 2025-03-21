'use client';

import { FC } from 'react';
import { Image } from '@fluentui/react-components';
import useStyles from './Header.styles';
import config from '../../../next.config';

const NavBar: FC = () => {
  const classes = useStyles();

  return (
    <div className={classes.header}>
      <div className={classes.titleContainer}>
        <h1 className={classes.title}>Explore AI-Powered Teams Apps</h1>
        <Image
          src={`${config.basePath}/teams.svg`}
          alt="Microsoft Teams"
          width={40}
          height={40}
          className={classes.titleIcon}
        />
      </div>
      <p className={classes.subtitle}>
        Ready-to-use samples showcasing AI agent integration with Microsoft
        Teams to enhance collaboration and productivity. ✨
      </p>
    </div>
  );
};

NavBar.displayName = 'NavBar';

export default NavBar;
