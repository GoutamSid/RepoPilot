import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCatalogue, ensureProjectMetadata, inferDomain } from '../src/catalogue.js';

const publicRepo = {
  id: 1,
  fullName: 'sample/learning-platform',
  name: 'learning-platform',
  owner: 'sample',
  description: 'Interactive learning resources',
  private: false,
  htmlUrl: 'https://github.com/sample/learning-platform',
  homepage: '',
  language: 'TypeScript',
  topics: ['education', 'learning'],
  stars: 4,
  forks: 1,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
  pushedAt: '2026-10-01T00:00:00Z',
  archived: false,
  disabled: false,
};

const privateRepo = {
  ...publicRepo,
  id: 2,
  fullName: 'sample/internal-project-name',
  name: 'internal-project-name',
  private: true,
  htmlUrl: 'https://github.com/sample/internal-project-name',
  topics: ['secret-topic'],
  stars: 0,
};

test('infers a domain from repository topics and metadata', () => {
  assert.equal(inferDomain(publicRepo), 'Education & Learning');
});

test('defaults public repositories to included and private repositories to excluded', () => {
  assert.equal(ensureProjectMetadata(publicRepo).include, true);
  assert.equal(ensureProjectMetadata(privateRepo).include, false);
});

test('does not export private project metadata unless explicitly selected', () => {
  const workspace = {
    repositories: [publicRepo, privateRepo],
    projects: {},
    manualProjects: [],
  };
  const result = buildCatalogue(workspace, new Date('2026-11-04T00:00:00.000Z'));
  assert.equal(result.projects.length, 1);
  assert.equal(result.projects[0].repositoryUrl, publicRepo.htmlUrl);
});

test('selected private project exports curated details but not private repository identifiers or metrics', () => {
  const workspace = {
    repositories: [privateRepo],
    projects: {
      [privateRepo.fullName]: {
        displayName: 'Internal project (public title)',
        purpose: 'A user-approved high-level summary',
        domain: 'Software & Developer Tools',
        stage: 'In development',
        include: true,
      },
    },
    manualProjects: [],
  };
  const result = buildCatalogue(workspace);
  const serialized = JSON.stringify(result);
  assert.equal(result.projects.length, 1);
  assert.equal(result.projects[0].repositoryUrl, '');
  assert.equal(result.projects[0].visibility, 'not-shared');
  assert.equal('topics' in result.projects[0], false);
  assert.equal('stars' in result.projects[0], false);
  assert.equal(serialized.includes('internal-project-name'), false);
  assert.equal(serialized.includes('secret-topic'), false);
});

test('rejects JSON output paths that escape the chosen website folder', async () => {
  const { assertRelativePath } = await import('../src/storage.js');
  assert.throws(() => assertRelativePath('../outside.json'), /must stay inside/);
  assert.throws(() => assertRelativePath(''), /non-empty relative path/);
  assert.equal(assertRelativePath('public/data/projects.json').replaceAll('\\', '/'), 'public/data/projects.json');
});
