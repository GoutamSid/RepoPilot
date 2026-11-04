export const DOMAINS = [
  'AI & Data',
  'Education & Learning',
  'Software & Developer Tools',
  'Productivity & Systems',
  'Creative & Design',
  'Engineering & Research',
  'Other',
];

export const STAGES = ['Idea', 'In development', 'Completed', 'Archived', 'Unspecified'];

export function inferDomain(repository) {
  const haystack = [
    repository.name,
    repository.description,
    repository.language,
    ...(repository.topics || []),
  ].join(' ').toLowerCase();

  if (/machine.?learning|artificial.?intelligence|\bai\b|llm|data.?science|analytics|pandas|pytorch/.test(haystack)) return 'AI & Data';
  if (/education|learning|course|teaching|quiz|school|student|edtech/.test(haystack)) return 'Education & Learning';
  if (/productivity|planner|task|goal|calendar|habit|workflow|personal.?management/.test(haystack)) return 'Productivity & Systems';
  if (/canvas|design|drawing|creative|image|graphics|illustration/.test(haystack)) return 'Creative & Design';
  if (/engineering|hydrology|water.?resource|simulation|research|geospatial|gis|civil/.test(haystack)) return 'Engineering & Research';
  if (/developer|cli|library|framework|api|tool|vscode|typescript|javascript|react|node|rust|go\b/.test(haystack)) return 'Software & Developer Tools';
  return 'Other';
}

export function ensureProjectMetadata(repository, existing = {}) {
  const saved = existing[repository.fullName] || {};
  return {
    displayName: saved.displayName ?? repository.name,
    purpose: saved.purpose ?? repository.description ?? '',
    domain: saved.domain ?? inferDomain(repository),
    stage: saved.stage ?? 'Unspecified',
    homepageUrl: saved.homepageUrl ?? repository.homepage ?? '',
    featured: saved.featured ?? false,
    include: saved.include ?? !repository.private,
  };
}

function cleanProjectName(value) {
  return String(value || '').trim();
}

export function buildCatalogue(workspace, now = new Date()) {
  const projects = [];

  for (const repository of workspace.repositories || []) {
    const metadata = ensureProjectMetadata(repository, workspace.projects || {});
    if (!metadata.include) continue;

    const project = {
      id: `github-${slug(metadata.displayName || repository.name)}`,
      name: cleanProjectName(metadata.displayName) || repository.name,
      purpose: String(metadata.purpose || '').trim(),
      domain: metadata.domain || 'Other',
      stage: metadata.stage || 'Unspecified',
      source: 'github',
      repositoryUrl: repository.private ? '' : repository.htmlUrl,
      homepageUrl: String(metadata.homepageUrl || '').trim(),
      featured: Boolean(metadata.featured),
    };

    // Deliberately do not export private repository identifiers, URLs, topics, or metrics.
    // The user may choose to publish only the curated display details for a private project.
    if (!repository.private) {
      project.visibility = 'public';
      project.language = repository.language || '';
      project.topics = repository.topics || [];
      project.stars = repository.stars || 0;
      project.forks = repository.forks || 0;
      project.updatedAt = repository.updatedAt || null;
      project.archived = Boolean(repository.archived);
    } else {
      project.visibility = 'not-shared';
    }
    projects.push(project);
  }

  for (const manual of workspace.manualProjects || []) {
    if (!manual.include) continue;
    const isPrivate = Boolean(manual.private);
    projects.push({
      id: `manual-${slug(manual.id || manual.name)}`,
      name: cleanProjectName(manual.displayName || manual.name),
      purpose: String(manual.purpose || '').trim(),
      domain: manual.domain || 'Other',
      stage: manual.stage || 'Unspecified',
      source: 'manual',
      repositoryUrl: isPrivate ? '' : String(manual.repositoryUrl || '').trim(),
      homepageUrl: String(manual.homepageUrl || '').trim(),
      featured: Boolean(manual.featured),
      visibility: isPrivate ? 'not-shared' : 'public',
    });
  }

  projects.sort((a, b) => a.domain.localeCompare(b.domain) || a.name.localeCompare(b.name));
  return {
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    projects,
  };
}

export function slug(value) {
  return String(value || 'project')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'project';
}

export function countIncluded(workspace) {
  const repositoryCount = (workspace.repositories || []).filter((repo) => ensureProjectMetadata(repo, workspace.projects || {}).include).length;
  const manualCount = (workspace.manualProjects || []).filter((project) => project.include).length;
  return repositoryCount + manualCount;
}

export function countPrivateIncluded(workspace) {
  const repositories = (workspace.repositories || []).filter((repo) => repo.private && ensureProjectMetadata(repo, workspace.projects || {}).include).length;
  const manual = (workspace.manualProjects || []).filter((project) => project.private && project.include).length;
  return repositories + manual;
}

export function isExportSafe(workspace) {
  return countPrivateIncluded(workspace) === 0;
}
