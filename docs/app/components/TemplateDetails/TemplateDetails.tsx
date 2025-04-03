'use client';

import { FC, useState } from 'react';
import { Button, Text, tokens, Skeleton } from '@fluentui/react-components';
import { ArrowLeft24Regular, Open16Regular } from '@fluentui/react-icons';
import useStyles from './TemplateDetails.styles';
import type { Template } from '@/app/page';
import NextLink from 'next/link';

export interface TemplateDetailsProps extends Template {}

interface MarkdownProps {
  markdownHtml: string;
  classes: Record<string, string>;
}

const Markdown: FC<MarkdownProps> = ({ markdownHtml, classes }) => {
  return (
    <span
      dangerouslySetInnerHTML={{ __html: markdownHtml }}
      className={classes.markdown}
    />
  );
};

const DemoImage = ({
  src,
  alt,
  classes,
}: {
  src: string;
  alt: string;
  classes: Record<string, string>;
}) => {
  const [isLoading, setIsLoading] = useState(true);

  return (
    <>
      {isLoading && <Skeleton className={classes.loadingSkeleton} />}
      <img
        src={src}
        alt={alt}
        className={`${classes.demo} ${isLoading ? 'hidden' : ''}`}
        loading="lazy"
        onLoad={() => setIsLoading(false)}
        onError={() => setIsLoading(false)}
      />
    </>
  );
};

const TemplateDetails: FC<TemplateDetailsProps> = ({
  title,
  description,
  longDescription,
  featuresList,
  githubUrl,
  language,
  tags,
  imageUrl,
  demoUrlGif,
}) => {
  const classes = useStyles();

  const getLanguageColor = (language: string) => {
    switch (language) {
      case 'JavaScript':
        return '#f1e05a';
      case 'Python':
        return '#3572A5';
      case 'TypeScript':
        return '#2b7489';
      case 'C#':
        return '#178600';
      default:
        return tokens.colorBrandBackground;
    }
  };

  return (
    <div className={classes.container}>
      <div className={classes.mainContent}>
        <div className={classes.leftColumn}>
          <div className={classes.leftColumnContent}>
            <NextLink href="/" className={classes.nextLink}>
              <Button
                appearance="subtle"
                icon={<ArrowLeft24Regular />}
                className={classes.backButton}
              >
                Back to Gallery
              </Button>
            </NextLink>
            <div className={classes.imageContainer}>
              <img src={imageUrl} alt={title} className={classes.image} />
            </div>
            <div className={classes.titleContainer}>
              <Text className={classes.title}>{title}</Text>
              <Text className={classes.description}>{description}</Text>
              <Button
                appearance="primary"
                icon={<Open16Regular />}
                as="a"
                href={githubUrl}
                target="_blank"
                className={classes.githubButton}
              >
                View on GitHub
              </Button>
              <div className={classes.titleMeta}>
                <div className={classes.metaSection}>
                  <Text className={classes.metaLabel}>LANGUAGE</Text>
                  <div className={classes.language}>
                    <span
                      className={classes.languageDot}
                      style={{ backgroundColor: getLanguageColor(language) }}
                    />
                    <Text>{language}</Text>
                  </div>
                </div>
                <div className={classes.metaSection}>
                  <Text className={classes.metaLabel}>TAGS</Text>
                  <div className={classes.tags}>
                    {tags.map((tag, index) => (
                      <span key={index} className={classes.tag}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={classes.rightColumn}>
          <div className={classes.section}>
            <Text className={classes.sectionTitle}>Description</Text>
            <div className={classes.contentBox}>
              <div className={classes.description}>
                <Markdown markdownHtml={longDescription} classes={classes} />
              </div>
            </div>
          </div>

          <div className={classes.section}>
            <Text className={classes.sectionTitle}>Features</Text>
            <div className={classes.contentBox}>
              <ul className={classes.featuresList}>
                {featuresList.map((feature, index) => (
                  <li key={index} className={classes.featureItem}>
                    <Markdown markdownHtml={feature} classes={classes} />
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className={classes.section}>
            <Text className={classes.sectionTitle}>Demo</Text>
            <div className={classes.demoContainer}>
              <DemoImage
                src={demoUrlGif}
                alt={`${title} demo`}
                classes={classes}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

TemplateDetails.displayName = 'TemplateDetails';

export default TemplateDetails;
