'use client';

import { FC } from 'react';

export interface MarkdownProps {
  markdownHtml: string;
  className?: string;
}

const Markdown: FC<MarkdownProps> = ({ markdownHtml, className }) => {
  return (
    <span
      dangerouslySetInnerHTML={{ __html: markdownHtml }}
      className={className}
    />
  );
};

export default Markdown; 