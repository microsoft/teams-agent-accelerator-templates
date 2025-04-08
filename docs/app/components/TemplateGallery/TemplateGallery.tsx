'use client';

import useStyles from './TemplateGallery.styles';
import TemplateCard from '../TemplateCard/TemplateCard';
import { FC, useState, useMemo } from 'react';
import config from '../../../next.config';
import { TemplateGalleryData } from '@/app/page';
import { Input } from '@fluentui/react-components';
import { Search24Regular } from '@fluentui/react-icons';

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
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTemplates = useMemo(() => {
    if (!searchQuery.trim()) {
      return templates;
    }

    const query = searchQuery.toLowerCase().trim();
    return templates.filter(template => 
      template.title.toLowerCase().includes(query) ||
      template.description.toLowerCase().includes(query) ||
      template.tags.some(tag => tag.toLowerCase().includes(query)) ||
      template.author.toLowerCase().includes(query) ||
      template.featuresList.some(feature => feature.toLowerCase().includes(query)) ||
      template.longDescription.toLowerCase().includes(query) ||
      template.language.toLowerCase().includes(query)
    );
  }, [templates, searchQuery]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  return (
    <div className={classes.root}>
      <div className={classes.container}>
        <div className={classes.searchContainer}>
          <Input
            contentBefore={<Search24Regular />}
            placeholder="Search templates..."
            value={searchQuery}
            onChange={handleSearchChange}
            className={classes.searchInput}
            appearance="outline"
            size="large"
          />
        </div>
        
        {filteredTemplates.length > 0 ? (
          <div className={classes.grid}>
            {filteredTemplates.map((template, index) => (
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
                demoYoutubeVideoId={template.demoYoutubeVideoId}
                longDescription={template.longDescription}
                featuresList={template.featuresList}
              />
            ))}
          </div>
        ) : (
          <div className={classes.noResults}>
            <p>No templates found matching &quot;{searchQuery}&quot;</p>
          </div>
        )}
      </div>
    </div>
  );
};

TemplateGallery.displayName = 'TemplateGallery';
export default TemplateGallery;
