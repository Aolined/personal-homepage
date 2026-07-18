import { zip } from 'fflate';

export interface ZipResultFile {
  name: string;
  blob: Blob;
}

function uniqueArchiveName(name: string, used: Set<string>): string {
  if (!used.has(name)) {
    used.add(name);
    return name;
  }

  const extensionIndex = name.lastIndexOf('.');
  const hasExtension = extensionIndex > 0;
  const base = hasExtension ? name.slice(0, extensionIndex) : name;
  const extension = hasExtension ? name.slice(extensionIndex) : '';
  let counter = 2;
  let candidate = `${base} (${counter})${extension}`;
  while (used.has(candidate)) {
    counter += 1;
    candidate = `${base} (${counter})${extension}`;
  }
  used.add(candidate);
  return candidate;
}

function safeArchiveName(name: string): string {
  const sanitized = name
    .replace(/[\u0000-\u001f\u007f/\\]/g, '_')
    .replace(/^[_.]+/, '_')
    .trim();
  return sanitized || 'converted-file';
}

export async function createResultZip(files: readonly ZipResultFile[]): Promise<Blob> {
  if (files.length === 0) throw new Error('没有可打包的转换结果。');

  const entries: Record<string, Uint8Array> = {};
  const usedNames = new Set<string>();
  for (const file of files) {
    const name = uniqueArchiveName(safeArchiveName(file.name), usedNames);
    entries[name] = new Uint8Array(await file.blob.arrayBuffer());
  }

  const bytes = await new Promise<Uint8Array>((resolve, reject) => {
    zip(entries, { level: 0 }, (error, data) => {
      if (error) reject(error);
      else resolve(data);
    });
  });

  return new Blob([Uint8Array.from(bytes)], { type: 'application/zip' });
}
