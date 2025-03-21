'use client';

import { Text, Input, Checkbox } from '@fluentui/react-components';
import { Search24Regular } from '@fluentui/react-icons';
import useStyles from './TemplateGallery.styles';
import TemplateCard from '../TemplateCard/TemplateCard';
import { FC, useEffect, useState } from 'react';
import { parse } from 'yaml';
import config from '../../../next.config';

interface Template {
  title: string;
  description: string;
  tags: string[];
  githubUrl: string;
  imageUrl: string;
  author: string;
  language: string;
  readmeUrl: string;
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
        console.log(response);
        const yamlText = await response.text();
        console.log(yamlText);
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
        {/* <div className={classes.sidebar}>
            <Text className={classes.sidebarTitle}>Filter Templates</Text>
            <div className={classes.searchContainer}>
              <Input
                placeholder="Search templates..."
                contentBefore={<Search24Regular />}
              />
            </div>
            <div className={classes.filterSection}>
              <Text className={classes.filterTitle}>Use Case</Text>
              <div>
                <Checkbox label="AI Chat" />
                <Checkbox label="Document Analysis" />
                <Checkbox label="Meeting Intelligence" />
              </div>
            </div>
          </div> */}
        <div className={classes.grid}>
          {templates.map((template, index) => (
            <TemplateCard
              key={index}
              title={template.title}
              description={template.description}
              imageUrl={resolveImageUrl(template.imageUrl)}
              githubUrl={template.githubUrl}
              author={template.author}
              language={template.language}
              tags={template.tags}
              readmeUrl={template.readmeUrl}
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
