'use client';

import { FC, useState } from 'react';
import { Card, CardPreview, Text, tokens } from '@fluentui/react-components';
import useStyles from './TemplateCard.styles';
import config from '../../../next.config';
import TemplateDetails from '../TemplateDetails/TemplateDetails';

export interface TemplateCardProps {
  title: string;
  description: string;
  imageUrl: string;
  githubUrl: string;
  author: string;
  language: string;
  tags: string[];
  readmeUrl: string;
  demoUrlGif: string;
  longDescription: string;
  featuresList: string[];
}

const TemplateCard: FC<TemplateCardProps> = ({
  title,
  description,
  imageUrl,
  githubUrl,
  author,
  language,
  tags,
  demoUrlGif,
  longDescription,
  featuresList,
}) => {
  const classes = useStyles();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const getLanguageColor = (language: string) => {
    // Retrieved from https://gist.github.com/robertpeteuil/bb2dc86f3b3e25d203664d61410bfa30
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

  const languageColorMap = {
    JavaScript: '#f1e05a',
    Python: '#3572A5',
    TypeScript: '#2b7489',
    'C#': '#178600',
  };

  return (
    <>
      <Card className={classes.card} onClick={() => setIsModalOpen(true)}>
        <CardPreview className={classes.preview}>
          <img
            src={imageUrl || `${config.basePath}/placeholder-img.svg`}
            alt={title}
            className={classes.previewImage}
          />
        </CardPreview>
        <div className={classes.content}>
          <Text className={classes.title}>{title}</Text>
          <Text className={classes.description}>{description}</Text>
          <div className={classes.tags}>
            {tags.slice(0, 2)?.map((tag, index) => (
              <span key={index} className={classes.tag}>
                {tag}
              </span>
            ))}
          </div>
          <div className={classes.footer}>
            <div className={classes.author}>
              <Text className={classes.authorText}>by {author}</Text>
            </div>
            <div className={classes.language}>
              <span
                className={classes.languageDot}
                style={{ backgroundColor: getLanguageColor(language) }}
              />
              <Text className={classes.languageText}>{language}</Text>
            </div>
          </div>
        </div>
      </Card>

      <TemplateDetails
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={title}
        description={description}
        imageUrl={imageUrl}
        githubUrl={githubUrl}
        author={author}
        language={language}
        tags={tags}
        demoUrlGif={demoUrlGif}
        longDescription={longDescription}
        featuresList={featuresList}
      />
    </>
  );
};

TemplateCard.displayName = 'TemplateCard';

export default TemplateCard;
