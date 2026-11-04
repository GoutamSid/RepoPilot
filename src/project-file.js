import fs from 'node:fs/promises';
import path from 'node:path';

export const PROJECT_FILE = 'project.json';
export const STAGES = ['Idea', 'In development', 'Completed', 'Archived'];
export const DEFAULT_SECTION = 'Projects';

const LIMITS = { name: 120, description: 600, section: 60 };

export function templateFor(folderName) {
  return {
    name: folderName,
    description: '',
    section: DEFAULT_SECTION,
    stage: 'In development',
    website: '',
    featured: false,
    show: false,
  };
}

export function validateProject(value) {
  const input = value && typeof value === 'object' ? value : {};
  const project = {
    name: text(input.name),
    description: text(input.description),
    section: text(input.section) || DEFAULT_SECTION,
    stage: input.stage,
    website: text(input.website),
    featured: input.featured === true,
    show: input.show === true,
  };

  const errors = [];
  if (!project.name) errors.push('Name is required.');
  if (project.name.length > LIMITS.name) errors.push(`Name must be ${LIMITS.name} characters or fewer.`);
  if (project.description.length > LIMITS.description) errors.push(`Description must be ${LIMITS.description} characters or fewer.`);
  if (project.section.length > LIMITS.section) errors.push(`Section must be ${LIMITS.section} characters or fewer.`);
  if (!STAGES.includes(project.stage)) errors.push(`Stage must be one of: ${STAGES.join(', ')}.`);
  if (project.website && !isHttpUrl(project.website)) errors.push('Website must start with http:// or https://.');

  return errors.length ? { ok: false, errors } : { ok: true, value: project };
}

export async function readProjectFile(folder) {
  let raw;
  try {
    raw = await fs.readFile(path.join(folder, PROJECT_FILE), 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return { status: 'missing' };
    return { status: 'invalid', errors: [`Could not read project.json: ${error.message}`] };
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    return { status: 'invalid', errors: [`project.json is not valid JSON (${error.message}).`] };
  }

  const checked = validateProject(data);
  return checked.ok
    ? { status: 'ready', project: checked.value }
    : { status: 'invalid', errors: checked.errors };
}

export async function writeProjectFile(folder, value) {
  await fs.writeFile(path.join(folder, PROJECT_FILE), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isHttpUrl(value) {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}
