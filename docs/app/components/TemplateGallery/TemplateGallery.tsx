'use client';

import useStyles from './TemplateGallery.styles';
import TemplateCard from '../TemplateCard/TemplateCard';
import { FC } from 'react';
import config from '../../../next.config';
import { TemplateGalleryData } from '@/app/page';

type TemplateGalleryProps = { templates: TemplateGalleryData };

const resolveImageUrl = (imageUrl: string) => {
  // If the image URL is relative, prepend the base path
  if (imageUrl.startsWith('/')) {
    return `${config.basePath}${imageUrl}`;
  }
  return imageUrl;
};

const TemplateGallery: FC<TemplateGalleryProps> = ({ templates }) => {
  const classes = useStyles();

  return (
    <div className={classes.root}>
      <div className={classes.container}>
        <div className={classes.grid}>
          {templates.map((template, index) => (
            <TemplateCard
              key={index}
              id={template.id}
              title={template.title}
              description={template.description}
              imageUrl={resolveImageUrl(template.imageUrl)}
              githubUrl={template.githubUrl}
              author={template.author}
              language={template.language}
              tags={template.tags}
              demoUrlGif={template.demoUrlGif}
              longDescription={template.longDescription}
              featuresList={template.featuresList}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

TemplateGallery.displayName = 'TemplateGallery';
export default TemplateGallery;
