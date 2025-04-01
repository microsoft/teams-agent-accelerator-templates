'use client';

import { FC } from 'react';
import { Card, CardPreview, Text, tokens } from '@fluentui/react-components';
import useStyles from './TemplateCard.styles';
import config from '../../../next.config';
import type { Template } from '../TemplateGallery/TemplateGallery';
import Link from 'next/link';

export type TemplateCardProps = Template;

const TemplateCard: FC<TemplateCardProps> = ({
  title,
  description,
  imageUrl,
  author,
  language,
  tags,
  id,
}) => {
  const classes = useStyles();

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

  return (
    <Link
      href={`/template/${id}`}
      className={classes.link}
      aria-label={`View ${title} template`}
    >
      <Card className={classes.card}>
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
    </Link>
  );
};

TemplateCard.displayName = 'TemplateCard';

export default TemplateCard;
