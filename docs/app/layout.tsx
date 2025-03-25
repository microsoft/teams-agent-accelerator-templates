'use client';

import {
  FluentProvider,
  webDarkTheme,
  webLightTheme,
} from '@fluentui/react-components';
import { useState, useEffect } from 'react';
import useStyles from './layout.styles';
import { ThemeContext } from './contexts/ThemeContext';
import ClarityScript from './clarity';
import PageLoader from './components/PageLoader/PageLoader';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const classes = useStyles();
  const [isDark, setIsDark] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const isProduction = process.env.NEXT_PUBLIC_BASE_PATH ? true : false;
  const toggleTheme = () => setIsDark(!isDark);

  useEffect(() => {
    // Simulate a minimum loading time to ensure styles are loaded
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <html lang="en">
      <body className={classes.root}>
        <ThemeContext.Provider value={{ isDark, toggleTheme }}>
          <FluentProvider theme={isDark ? webDarkTheme : webLightTheme}>
            {isLoading ? (
              <PageLoader />
            ) : (
              <main className={classes.main}>{children}</main>
            )}
          </FluentProvider>
        </ThemeContext.Provider>
        {isProduction ? <ClarityScript /> : null}
      </body>
    </html>
  );
}
