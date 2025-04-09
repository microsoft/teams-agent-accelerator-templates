import { makeStyles } from '@griffel/react';
import { tokens } from '@fluentui/react-components';

const useStyles = makeStyles({
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: '8px',
    padding: '20px',
    maxWidth: '90vw',
    width: '800px',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: '10px',
    borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
    minHeight: '40px',
  },
  title: {
    margin: 0,
    fontSize: '1.25rem',
    color: tokens.colorNeutralForeground1,
    fontWeight: 600,
  },
  closeButton: {},
  content: {
    marginTop: '15px',
    position: 'relative',
    width: '100%',
    '& > img': {
        maxWidth: '100%',
        maxHeight: 'calc(80vh - 80px)',
        display: 'block',
        margin: '0 auto',
    }
  },
});

export default useStyles; 