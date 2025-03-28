'use client';

import useStyles from './SampleGallery.styles';
import SampleCard from '../SampleCard/SampleCard';
import { FC, useEffect, useState } from 'react';
import { parse } from 'yaml';
import config from '../../../next.config';

export interface Sample {
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

interface SamplesData {
  samples: Sample[];
}

const resolveImageUrl = (imageUrl: string) => {
  // If the image URL is relative, prepend the base path
  if (imageUrl.startsWith('/')) {
    return `${config.basePath}${imageUrl}`;
  }
  return imageUrl;
};

const SampleGallery: FC = () => {
  const classes = useStyles();
  const [samples, setSamples] = useState<Sample[]>([]);

  useEffect(() => {
    async function loadSamples() {
      try {
        const response = await fetch(`${config.basePath}/data/samples.yaml`);
        const yamlText = await response.text();
        const data = parse(yamlText) as SamplesData;
        setSamples(data.samples);
      } catch (error) {
        console.error('Error loading samples:', error);
      }
    }

    loadSamples();
  }, []);

  return (
    <div className={classes.root}>
      <div className={classes.container}>
        <div className={classes.grid}>
          {samples.map((sample, index) => (
            <SampleCard
              key={index}
              id={sample.id}
              title={sample.title}
              description={sample.description}
              imageUrl={resolveImageUrl(sample.imageUrl)}
              githubUrl={sample.githubUrl}
              author={sample.author}
              language={sample.language}
              tags={sample.tags}
              demoUrlGif={sample.demoUrlGif}
              longDescription={sample.longDescription}
              featuresList={sample.featuresList}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

SampleGallery.displayName = 'SampleGallery';
export default SampleGallery;
