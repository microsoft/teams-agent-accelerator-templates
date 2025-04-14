'use client';

import { FC, useState } from 'react';
import { Card, CardPreview, Text } from '@fluentui/react-components';
import { Open16Regular, Open16Filled } from '@fluentui/react-icons';
import useStyles from './TemplateCard.styles';
import config from '../../../next.config';
import type { Template } from '@/app/page';
import Link from 'next/link';
import Modal from '../Modal/Modal';
import MediaViewer from '../MediaViewer/MediaViewer';
import Markdown from '../Markdown/Markdown';
import { getLanguageColor } from '../TemplateDetails/TemplateDetails';

export interface TemplateCardProps extends Template {}

const TemplateCard: FC<TemplateCardProps> = ({
  title,
  description,
  imageUrl,
  author,
  tags,
  id,
  githubUrl,
  demoUrlGif,
  demoYoutubeVideoId,
  featuresList,
  language,
}) => {
  const classes = useStyles();
  const [isLoading, setIsLoading] = useState(true);
  const [isGithubHovered, setIsGithubHovered] = useState(false);
  const [isImageHovered, setIsImageHovered] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleImageLoad = () => {
    setIsLoading(false);
  };

  const handleGithubActionClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.open(githubUrl, '_blank');
  };

  const handlePreviewClick = (e: React.MouseEvent) => {
    if (demoYoutubeVideoId || demoUrlGif) {
      e.preventDefault();
      e.stopPropagation();
      setIsModalOpen(true);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const hasDemo = !!(demoYoutubeVideoId || demoUrlGif);


  return (
    <>
      <Link
        href={`/template/${id}`}
        className={classes.link}
        aria-label={`View ${title} template details`}
      >
        <Card className={classes.card}>
          <CardPreview
            className={classes.preview}
            onClick={hasDemo ? handlePreviewClick : undefined}
            onMouseEnter={hasDemo ? () => setIsImageHovered(true) : undefined}
            onMouseLeave={hasDemo ? () => setIsImageHovered(false) : undefined}
            style={{ cursor: hasDemo ? 'pointer' : 'default' }}
            role="region"
            aria-label={`${title} preview`}
            tabIndex={hasDemo ? 0 : -1}
            onKeyDown={(e) => {
              if (hasDemo && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                handlePreviewClick(e as any);
              }
            }}
          >
            <div className={classes.imageContainer}>
              {isLoading && (
                <div className={classes.skeleton} />
              )}
              <img
                src={imageUrl || `${config.basePath}/placeholder-img.svg`}
                alt={title}
                className={classes.previewImage}
                style={{ opacity: isLoading ? 0 : 1 }}
                onLoad={handleImageLoad}
              />
              {hasDemo && isImageHovered && !isLoading && (
                <div className={classes.playOverlay}>
                  <Text className={classes.playText}>View Demo</Text>
                </div>
              )}
            </div>
          </CardPreview>
          
          {/* Title and Description Section */}
          <div className={classes.content}>
            <div className={classes.titleRow}>
              <Text className={classes.title}>{title}</Text>
              <div
                className={classes.actionButton}
                onClick={handleGithubActionClick}
                onMouseEnter={() => setIsGithubHovered(true)}
                onMouseLeave={() => setIsGithubHovered(false)}
                aria-label={`View ${title} on GitHub`}
              >
                {isGithubHovered ? <Open16Filled /> : <Open16Regular />}
              </div>
            </div>
            <Text className={classes.description}>{description}</Text>
          </div>
          
          {/* Features Section */}
          {featuresList && featuresList.length > 0 && (
            <div className={classes.featuresSection}>
              <div className={classes.divider} />
              <ul className={classes.featuresList}>
                {featuresList.slice(0, 8).map((feature, index) => (
                  <li key={index} className={classes.feature}>
                    <Markdown markdownHtml={feature} />
                  </li>
                ))}
                {featuresList.length > 8 && (
                  <li className={classes.feature} style={{ fontStyle: 'italic' }}>
                    +{featuresList.length - 8} more features
                  </li>
                )}
              </ul>
            </div>
          )}
          
          {/* Tags Section */}
          {tags && tags.length > 0 && (
            <div className={classes.tagsSection}>
              <div className={classes.tags}>
                {tags.map((tag, index) => (
                  <span key={index} className={classes.tag}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {/* Footer Section */}
          <div className={classes.footer}>
            <div className={classes.author}>
              <Text className={classes.authorText}>by {author}</Text>
            </div>
            
            {language && (
              <div className={classes.language}>
                <span
                  className={classes.languageDot}
                  style={{ backgroundColor: getLanguageColor(language) }}
                />
                <Text className={classes.languageText}>{language}</Text>
              </div>
            )}
          </div>
        </Card>
      </Link>

      <Modal isOpen={isModalOpen} onClose={closeModal} title={title}>
        <MediaViewer 
          youtubeVideoId={demoYoutubeVideoId}
          gifUrl={demoUrlGif}
          title={title}
        />
      </Modal>
    </>
  );
};

TemplateCard.displayName = 'TemplateCard';
export default TemplateCard;
