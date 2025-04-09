'use client';

import { FC, useState } from 'react';
import { Card, CardPreview, Text } from '@fluentui/react-components';
import { Open16Regular, Open16Filled, PlayCircle24Regular } from '@fluentui/react-icons';
import useStyles from './TemplateCard.styles';
import config from '../../../next.config';
import type { Template } from '@/app/page';
import Link from 'next/link';
import Modal from '../Modal/Modal';
import MediaViewer from '../MediaViewer/MediaViewer';

export type TemplateCardProps = Template;

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
                <div
                  className={classes.skeleton}
                />
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
                onClick={handleGithubActionClick}
                onMouseEnter={() => setIsGithubHovered(true)}
                onMouseLeave={() => setIsGithubHovered(false)}
                aria-label={`View ${title} on GitHub`}
              >
                {isGithubHovered ? <Open16Filled /> : <Open16Regular />}
              </div>
            </div>
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
