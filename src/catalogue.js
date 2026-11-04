export function slug(value) {
  return String(value || 'project')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'project';
}

export function buildWebsiteData(entries, now = new Date()) {
  const sections = {};
  for (const entry of entries) {
    if (entry.status !== 'ready' || !entry.project.show) continue;
    const project = entry.project;
    (sections[project.section] ??= []).push({
      id: slug(entry.folder),
      name: project.name,
      description: project.description,
      stage: project.stage,
      website: project.website,
      featured: project.featured,
    });
  }

  const ordered = {};
  for (const section of Object.keys(sections).sort((a, b) => a.localeCompare(b))) {
    ordered[section] = sections[section].sort(
      (a, b) => Number(b.featured) - Number(a.featured) || a.name.localeCompare(b.name)
    );
  }
  return { schemaVersion: 2, generatedAt: now.toISOString(), sections: ordered };
}
