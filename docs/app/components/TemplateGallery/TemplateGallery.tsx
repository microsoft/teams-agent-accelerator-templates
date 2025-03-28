'use client';

import useStyles from './TemplateGallery.styles';
import TemplateCard from '../TemplateCard/TemplateCard';
import { FC, useEffect, useState } from 'react';
import { parse } from 'yaml';
import config from '../../../next.config';

export interface Template {
  id: string;
  title: string;
  description: string;
  tags: string[];
  githubUrl: string;
  imageUrl: string;
  author: string;
  language: string;
  demoUrlGif: string;
  longDescription: string;
  featuresList: string[];
}

interface TemplatesData {
  templates: Template[];
}

const resolveImageUrl = (imageUrl: string) => {
  // If the image URL is relative, prepend the base path
  if (imageUrl.startsWith('/')) {
    return `${config.basePath}${imageUrl}`;
  }
  return imageUrl;
};

const TemplateGallery: FC = () => {
  const classes = useStyles();
  const [templates, setTemplates] = useState<Template[]>([]);

  useEffect(() => {
    async function loadTemplates() {
      try {
        const response = await fetch(`${config.basePath}/data/templates.yaml`);
        const yamlText = await response.text();
        const data = parse(yamlText) as TemplatesData;
        setTemplates(data.templates);
      } catch (error) {
        console.error('Error loading templates:', error);
      }
    }

    loadTemplates();
  }, []);

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
