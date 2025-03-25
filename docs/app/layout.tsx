'use client';

import {
  FluentProvider,
  webDarkTheme,
  webLightTheme,
} from '@fluentui/react-components';
import { useState } from 'react';
import useStyles from './layout.styles';
import { ThemeContext } from './contexts/ThemeContext';
import ClarityScript from './clarity';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const classes = useStyles();
  const [isDark, setIsDark] = useState(false);

  const isProduction = process.env.NEXT_PUBLIC_BASE_PATH ? true : false;
  const toggleTheme = () => setIsDark(!isDark);

  return (
    <html lang="en">
      <body className={classes.root}>
        <ThemeContext.Provider value={{ isDark, toggleTheme }}>
          <FluentProvider theme={isDark ? webDarkTheme : webLightTheme}>
            <main className={classes.main}>{children}</main>
          </FluentProvider>
        </ThemeContext.Provider>
        {isProduction ? <ClarityScript /> : null}
      </body>
    </html>
  );
}
