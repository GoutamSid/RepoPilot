import fs from 'node:fs/promises';
import path from 'node:path';

export const LOCAL_DIR_NAME = '.repopilot';
export const DEFAULT_EXPORT_RELATIVE_PATH = path.join('public', 'data', 'projects.json');

export function getLocalDir(root = process.cwd()) {
  return path.join(root, LOCAL_DIR_NAME);
}

export async function ensureWorkspace(root = process.cwd()) {
  const localDir = getLocalDir(root);
  await fs.mkdir(localDir, { recursive: true });
  return localDir;
}

export async function readJson(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
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

export async function loadWorkspace(root = process.cwd()) {
  const localDir = await ensureWorkspace(root);
  const workspacePath = path.join(localDir, 'workspace.json');
  const workspace = await readJson(workspacePath, {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    lastFetchedAt: null,
    githubAccount: null,
    websiteRoot: null,
    exportRelativePath: DEFAULT_EXPORT_RELATIVE_PATH,
    repositories: [],
    projects: {},
    manualProjects: [],
  });
  workspace.repositories ??= [];
  workspace.projects ??= {};
  workspace.manualProjects ??= [];
  workspace.exportRelativePath ??= DEFAULT_EXPORT_RELATIVE_PATH;
  return { localDir, workspacePath, workspace };
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

export async function saveWorkspace(workspacePath, workspace) {
  await writeJson(workspacePath, workspace);
}
