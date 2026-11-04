import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { readProjectFile, templateFor, validateProject } from '../src/project-file.js';
import { scanProjectsFolder } from '../src/scan.js';
import { buildWebsiteData } from '../src/catalogue.js';
import { assertRelativePath } from '../src/storage.js';

const complete = {
  name: 'Learning Platform',
  description: 'Interactive lessons.',
  section: 'Education',
  stage: 'In development',
  website: 'https://example.com',
  featured: true,
  show: true,
};

test('accepts a complete project and fills the default section', () => {
  const result = validateProject({ ...complete, section: '' });
  assert.equal(result.ok, true);
  assert.equal(result.value.section, 'Projects');
});

test('rejects a missing name, an unknown stage, and a non-http website', () => {
  const result = validateProject({ ...complete, name: '', stage: 'Done', website: 'javascript:alert(1)' });
  assert.equal(result.ok, false);
  assert.equal(result.errors.length, 3);
});

test('new template stays hidden until the owner turns it on', () => {
  assert.equal(templateFor('my-app').show, false);
});

test('scan reports ready, invalid, and missing folders and skips hidden or node_modules folders', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'repopilot-'));
  try {
    await fs.mkdir(path.join(root, 'alpha'));
    await fs.writeFile(path.join(root, 'alpha', 'project.json'), JSON.stringify(complete));
    await fs.mkdir(path.join(root, 'beta'));
    await fs.writeFile(path.join(root, 'beta', 'project.json'), '{ broken');
    await fs.mkdir(path.join(root, 'gamma'));
    await fs.mkdir(path.join(root, 'node_modules'));
    await fs.mkdir(path.join(root, '.git'));

    const entries = await scanProjectsFolder(root);
    assert.deepEqual(entries.map((entry) => [entry.folder, entry.status]), [
      ['alpha', 'ready'],
      ['beta', 'invalid'],
      ['gamma', 'missing'],
    ]);
    assert.equal((await readProjectFile(path.join(root, 'gamma'))).status, 'missing');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('website data includes only shown projects, grouped by section, without folder names', () => {
  const entries = [
    { folder: 'alpha', status: 'ready', project: { ...complete, show: true } },
    { folder: 'hidden', status: 'ready', project: { ...complete, name: 'Hidden', show: false } },
    { folder: 'broken', status: 'invalid', errors: ['bad'] },
    { folder: 'gamma', status: 'missing' },
  ];
  const data = buildWebsiteData(entries, new Date('2026-11-04T00:00:00Z'));
  assert.equal(data.schemaVersion, 2);
  assert.deepEqual(Object.keys(data.sections), ['Education']);
  assert.equal(data.sections.Education.length, 1);
  assert.equal(data.sections.Education[0].id, 'alpha');
  assert.equal('folder' in data.sections.Education[0], false);
});

test('keeps the JSON output inside the website folder', () => {
  assert.throws(() => assertRelativePath('../outside.json'), /must stay inside/);
  assert.throws(() => assertRelativePath(''), /non-empty relative path/);
  assert.equal(assertRelativePath('public/data/projects.json').replaceAll('\\', '/'), 'public/data/projects.json');
});
