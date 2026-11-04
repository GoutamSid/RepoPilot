import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DEFAULT_OUTPUT_PATH = 'public/data/projects.json';

const SETTINGS_PATH = path.join(APP_ROOT, '.repopilot', 'settings.json');
const DEFAULT_SETTINGS = { projectsFolder: '', websiteFolder: '', outputRelativePath: DEFAULT_OUTPUT_PATH };

export async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw new Error(`Could not read ${filePath}: ${error.message}`);
  }
}

export async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp`;
  await fs.writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await fs.rename(temporaryPath, filePath);
}

export function assertRelativePath(relativePath) {
  if (typeof relativePath !== 'string' || !relativePath.trim() || path.isAbsolute(relativePath)) {
    throw new Error('The JSON destination must be a non-empty relative path inside the website folder.');
  }
  const normalized = path.normalize(relativePath);
  if (normalized === '..' || normalized.startsWith(`..${path.sep}`)) {
    throw new Error('The JSON destination must stay inside the selected website folder.');
  }
  return normalized;
}

export async function loadSettings() {
  return { ...DEFAULT_SETTINGS, ...(await readJson(SETTINGS_PATH, {})) };
}

export async function saveSettings(settings) {
  await writeJson(SETTINGS_PATH, settings);
}
