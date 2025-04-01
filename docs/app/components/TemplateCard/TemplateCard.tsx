'use client';

import { FC, useState } from 'react';
import { Card, CardPreview, Text } from '@fluentui/react-components';
import { Open16Regular, Open16Filled } from '@fluentui/react-icons';
import useStyles from './TemplateCard.styles';
import config from '../../../next.config';
import type { Template } from '@/app/page';
import Link from 'next/link';

export type TemplateCardProps = Template;

const TemplateCard: FC<TemplateCardProps> = ({
  title,
  description,
  imageUrl,
  author,
  tags,
  id,
  githubUrl,
}) => {
  const classes = useStyles();
  const [isLoading, setIsLoading] = useState(true);
  const [isHovered, setIsHovered] = useState(false);

  const handleImageLoad = () => {
    setIsLoading(false);
  };

  const handleActionClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.open(githubUrl, '_blank');
  };

  return (
    <Link
      href={`/template/${id}`}
      className={classes.link}
      aria-label={`View ${title} template`}
    >
      <Card className={classes.card}>
        <CardPreview className={classes.preview}>
          <div
            className={classes.skeleton}
            style={{ opacity: isLoading ? 1 : 0 }}
          />
          <img
            src={imageUrl || `${config.basePath}/placeholder-img.svg`}
            alt={title}
            className={classes.previewImage}
            style={{ opacity: isLoading ? 0 : 1 }}
            onLoad={handleImageLoad}
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
            <div
              className={classes.actionButton}
              onClick={handleActionClick}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              aria-label={`View ${title} on GitHub`}
            >
              {isHovered ? <Open16Filled /> : <Open16Regular />}
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
};

TemplateCard.displayName = 'TemplateCard';

export default TemplateCard;
