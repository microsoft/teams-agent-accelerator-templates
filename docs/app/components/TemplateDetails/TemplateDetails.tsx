'use client';

import { FC } from 'react';
import { Button, Text, Link, tokens } from '@fluentui/react-components';
import { ArrowLeft24Regular, Open16Regular } from '@fluentui/react-icons';
import Modal from '../Modal/Modal';
import useStyles from './TemplateDetails.styles';

interface TemplateDetailsProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
  longDescription: string;
  featuresList: string[];
  githubUrl: string;
  language: string;
  tags: string[];
  imageUrl: string;
  demoUrlGif: string;
  author: string;
}

const renderMarkdown = (text: string): JSX.Element => {
  // First process bold text
  const processBold = (part: string): JSX.Element[] => {
    const parts = part.split(/(\*\*.*?\*\*)/g);
    return parts.map((boldPart, idx) => {
      const boldMatch = boldPart.match(/\*\*(.*?)\*\*/);
      if (boldMatch) {
        return <b key={idx}>{boldMatch[1]}</b>;
      }
      return <span key={idx}>{boldPart}</span>;
    });
  };

  // Then process links and line breaks
  const parts = text.split(/(\[.*?\]\(.*?\))/g);
  const elements = parts.map((part, index) => {
    const linkMatch = part.match(/\[(.*?)\]\((.*?)\)/);
    if (linkMatch) {
      const [, text, url] = linkMatch;
      return (
        <Link key={index} href={url} target="_blank">
          {processBold(text)}
        </Link>
      );
    }
    return (
      <span key={index}>
        {part.split('\n').map((line, i) =>
          i === 0 ? (
            processBold(line)
          ) : (
            <span key={i}>
              <br />
              <br />
              {processBold(line)}
            </span>
          )
        )}
      </span>
    );
  });

  return <span>{elements}</span>;
};

const TemplateDetails: FC<TemplateDetailsProps> = ({
  isOpen,
  onClose,
  title,
  description,
  longDescription,
  featuresList,
  githubUrl,
  language,
  tags,
  imageUrl,
  demoUrlGif,
  author,
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
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className={classes.container}>
        <div className={classes.header}>
          <Button
            appearance="subtle"
            icon={<ArrowLeft24Regular />}
            onClick={onClose}
          >
            Back to Gallery
          </Button>
          <Button
            appearance="primary"
            icon={<Open16Regular />}
            as="a"
            href={githubUrl}
            target="_blank"
          >
            View on GitHub
          </Button>
        </div>

        <div className={classes.mainContent}>
          <div className={classes.leftColumn}>
            <div className={classes.leftColumnContent}>
              <div className={classes.imageContainer}>
                <img src={imageUrl} alt={title} className={classes.image} />
              </div>
              <div className={classes.titleContainer}>
                <Text className={classes.title}>{title}</Text>
                <Text className={classes.description}>{description}</Text>
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
                  {renderMarkdown(longDescription)}
                </div>
              </div>
            </div>

            <div className={classes.section}>
              <Text className={classes.sectionTitle}>Features</Text>
              <div className={classes.contentBox}>
                <ul className={classes.featuresList}>
                  {featuresList.map((feature, index) => (
                    <li key={index} className={classes.featureItem}>
                      {renderMarkdown(feature)}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className={classes.section}>
              <Text className={classes.sectionTitle}>Demo</Text>
              <div className={classes.demoContainer}>
                <img
                  src={demoUrlGif}
                  alt={`${title} demo`}
                  className={classes.demo}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

TemplateDetails.displayName = 'TemplateDetails';

export default TemplateDetails;
