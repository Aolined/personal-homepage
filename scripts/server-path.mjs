import { isAbsolute, relative, resolve } from 'node:path';

export function resolveStaticPath(root, requestedPath) {
  const relativePath = requestedPath === '/' ? 'index.html' : requestedPath.replace(/^\/+/, '');
  const filePath = resolve(root, relativePath);
  const boundary = relative(resolve(root), filePath);
  if (boundary.startsWith('..') || isAbsolute(boundary)) return null;
  return filePath;
}
