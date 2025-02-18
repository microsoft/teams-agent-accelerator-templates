import log from 'loglevel';
import prefix from 'loglevel-plugin-prefix';

const Colors = {
    Reset: '\x1b[0m',
    Green: '\x1b[32m', 
    Red: '\x1b[31m',
    Yellow: '\x1b[33m',
    Cyan: '\x1b[36m'
} as const;

const colorizeLevel = (level: string): string => {
    switch (level.toLowerCase()) {
        case 'info': return Colors.Green + level + Colors.Reset;
        case 'error': return Colors.Red + level + Colors.Reset;
        case 'warn': return Colors.Yellow + level + Colors.Reset;
        case 'debug': return Colors.Cyan + level + Colors.Reset;
        default: return level;
    }
};

prefix.reg(log);
prefix.apply(log, {
    format(level, name, timestamp) {
        return `[${timestamp}] [${name}] [${colorizeLevel(level)}]`;
    },
    timestampFormatter(date) {
        return date.toISOString();
    }
});

export type Logger = log.Logger;

export const createLogger = (name: string, level: keyof typeof log.levels = "DEBUG"): Logger => {
    const logger = log.getLogger(name);
    logger.setLevel(log.levels[level]);
    return logger;
};