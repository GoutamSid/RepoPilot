import fs from 'node:fs/promises';
import path from 'node:path';
import { assertRelativePath, loadSettings, saveSettings, writeJson } from './storage.js';
import { scanProjectsFolder } from './scan.js';
import { buildWebsiteData } from './catalogue.js';
import { STAGES, readProjectFile, templateFor, validateProject, writeProjectFile } from './project-file.js';

export class ActionError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function requireDirectory(value, label) {
  const text = typeof value === 'string' ? value.trim().replace(/^"(.*)"$/, '$1') : '';
  if (!text) throw new ActionError(400, `${label} is required.`);
  const resolved = path.resolve(text);
  const stats = await fs.stat(resolved).catch(() => null);
  if (!stats?.isDirectory()) throw new ActionError(400, `${label} was not found: ${resolved}`);
  return resolved;
}

function checkedOutputPath(value) {
  try {
    return assertRelativePath(value);
  } catch (error) {
    throw new ActionError(400, error.message);
  }
}

async function scanCurrent() {
  const settings = await loadSettings();
  if (!settings.projectsFolder) return { settings, folders: [], projectsError: '' };
  try {
    return { settings, folders: await scanProjectsFolder(settings.projectsFolder), projectsError: '' };
  } catch (error) {
    return { settings, folders: [], projectsError: `Could not read ${settings.projectsFolder}: ${error.message}` };
  }
}

function countProjects(data) {
  return Object.values(data.sections).reduce((total, list) => total + list.length, 0);
}

export async function currentState() {
  const { settings, folders, projectsError } = await scanCurrent();
  return { settings, folders, projectsError, stages: STAGES };
}

export async function setFolder(kind, folderPath) {
  if (kind !== 'projects' && kind !== 'website') throw new ActionError(400, 'Unknown folder type.');
  const label = kind === 'projects' ? 'Projects folder' : 'Website folder';
  const resolved = await requireDirectory(folderPath, label);
  const settings = await loadSettings();
  if (kind === 'projects') settings.projectsFolder = resolved;
  else settings.websiteFolder = resolved;
  await saveSettings(settings);
  return currentState();
}

export async function setOutputPath(relativePath) {
  const settings = await loadSettings();
  settings.outputRelativePath = checkedOutputPath(relativePath);
  await saveSettings(settings);
  return currentState();
}

async function projectFolder(name) {
  const settings = await loadSettings();
  if (!settings.projectsFolder) throw new ActionError(400, 'Choose your projects folder first.');
  if (typeof name !== 'string' || !name || name.startsWith('.') || name !== path.basename(name)) {
    throw new ActionError(400, 'Invalid project folder.');
  }
  return requireDirectory(path.join(settings.projectsFolder, name), 'Project folder');
}

export async function saveProject(name, value) {
  const folder = await projectFolder(name);
  const checked = validateProject(value);
  if (!checked.ok) throw new ActionError(400, checked.errors.join(' '));
  await writeProjectFile(folder, checked.value);
  return currentState();
}

export async function createTemplate(name) {
  const folder = await projectFolder(name);
  if ((await readProjectFile(folder)).status !== 'missing') throw new ActionError(409, 'This folder already has a project.json.');
  await writeProjectFile(folder, templateFor(name));
  return currentState();
}

export async function buildPreview() {
  const { settings, folders } = await scanCurrent();
  const data = buildWebsiteData(folders);
  const outputPath = settings.websiteFolder ? path.join(settings.websiteFolder, settings.outputRelativePath) : '';
  return { data, count: countProjects(data), outputPath };
}

export async function writeWebsiteFile() {
  const { settings, folders } = await scanCurrent();
  if (!settings.projectsFolder) throw new ActionError(400, 'Choose your projects folder first.');
  const websiteFolder = await requireDirectory(settings.websiteFolder, 'Website folder');
  const data = buildWebsiteData(folders);
  const outputPath = path.join(websiteFolder, checkedOutputPath(settings.outputRelativePath));
  await writeJson(outputPath, data);
  return { outputPath, count: countProjects(data) };
}
