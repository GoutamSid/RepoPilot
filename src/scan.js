import fs from 'node:fs/promises';
import path from 'node:path';
import { readProjectFile } from './project-file.js';

const IGNORED_FOLDERS = new Set(['node_modules']);

export async function scanProjectsFolder(root) {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const names = entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.') && !IGNORED_FOLDERS.has(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  return Promise.all(names.map(async (name) => ({
    folder: name,
    ...(await readProjectFile(path.join(root, name))),
  })));
}
