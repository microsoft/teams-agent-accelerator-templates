import path from "path";

export function pathToSrc() {
    if (process.env.ENVIRONMENT === 'dev') {
        return path.join(__dirname);
    } else if (process.env.ENVIRONMENT == 'prod') {
        return path.join(__dirname, '..', 'src');
    } else {
        throw new Error('Invalid environment');
    }
}