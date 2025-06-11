import path from 'path';

export function pathToSrc(relativePath: string): string {
    return path.join(__dirname, relativePath);
}
