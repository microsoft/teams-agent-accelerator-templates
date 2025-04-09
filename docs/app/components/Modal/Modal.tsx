'use client';

import React, { FC, ReactNode } from 'react';
import useStyles from './Modal.styles';
import { Dismiss24Regular } from '@fluentui/react-icons';
import { Button } from '@fluentui/react-components';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string; // Optional title
}

const Modal: FC<ModalProps> = ({ isOpen, onClose, children, title }) => {
  const classes = useStyles();

  // Prevent background scroll when modal is open
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Handle Escape key to close modal
  React.useEffect(() => {
    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscapeKey);
    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className={classes.overlay} onClick={onClose}>
      <div className={classes.modal} onClick={(e) => e.stopPropagation()}> {/* Prevent closing when clicking inside modal */}
        <div className={classes.header}>
          {title && <h2 className={classes.title}>{title}</h2>}
          <Button 
            icon={<Dismiss24Regular />} 
            onClick={onClose} 
            appearance="transparent" 
            className={classes.closeButton}
            aria-label="Close modal"
          />
        </div>
        <div className={classes.content}>
          {children}
        </div>
      </div>
    </div>
  );
};

Modal.displayName = 'Modal';
export default Modal; 