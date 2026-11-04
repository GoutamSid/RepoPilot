import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fetchRepositories, getGitHubToken } from './github.js';
import {
  DOMAINS, STAGES, buildCatalogue, ensureProjectMetadata,
  countIncluded, countPrivateIncluded,
} from './catalogue.js';
import {
  DEFAULT_EXPORT_RELATIVE_PATH, assertRelativePath, loadWorkspace, saveWorkspace, writeJson,
} from './storage.js';
import { publishCatalogue } from './publish.js';

const rl = readline.createInterface({ input, output, terminal: Boolean(input.isTTY && output.isTTY) });
let state;

function line() { console.log(''); }
function divider() { console.log('─'.repeat(72)); }

async function ask(question, defaultValue = '') {
  const suffix = defaultValue !== '' ? ` [${defaultValue}]` : '';
  const answer = await rl.question(`${question}${suffix}: `);
  return answer.trim() || String(defaultValue);
}

async function askClearable(question, defaultValue = '') {
  const hint = defaultValue ? ` [${defaultValue}] (enter '-' to clear)` : '';
  const answer = (await rl.question(`${question}${hint}: `)).trim();
  if (answer === '-') return '';
  return answer || defaultValue;
}

async function askYesNo(question, defaultValue = false) {
  const hint = defaultValue ? 'Y/n' : 'y/N';
  const answer = (await rl.question(`${question} (${hint}): `)).trim().toLowerCase();
  if (!answer) return defaultValue;
  return ['y', 'yes'].includes(answer);
}

async function choose(question, choices, defaultValue) {
  line();
  console.log(question);
  choices.forEach((choice, index) => console.log(`  ${index + 1}. ${choice}`));
  const defaultIndex = Math.max(0, choices.indexOf(defaultValue)) + 1;
  const answer = await ask('Choose a number', String(defaultIndex));
  const index = Number(answer) - 1;
  if (!Number.isInteger(index) || index < 0 || index >= choices.length) {
    console.log('Invalid choice; keeping the current value.');
    return defaultValue;
  }
  return choices[index];
}

function currentMetadata(repository) {
  return ensureProjectMetadata(repository, state.workspace.projects);
}

function ensureRepositoryMetadata() {
  for (const repository of state.workspace.repositories) {
    if (!state.workspace.projects[repository.fullName]) {
      state.workspace.projects[repository.fullName] = ensureProjectMetadata(repository);
    }
  }
}

async function persist() {
  await saveWorkspace(state.workspacePath, state.workspace);
}

function printSummary() {
  const publicCount = state.workspace.repositories.filter((repo) => !repo.private).length;
  const privateCount = state.workspace.repositories.filter((repo) => repo.private).length;
  console.log(`GitHub account: ${state.workspace.githubAccount || 'Not fetched yet'}`);
  console.log(`Repositories: ${state.workspace.repositories.length} total (${publicCount} public, ${privateCount} private)`);
  console.log(`Manual entries: ${state.workspace.manualProjects.length}`);
  console.log(`Included in JSON: ${countIncluded(state.workspace)}`);
  console.log(`Private entries selected: ${countPrivateIncluded(state.workspace)}`);
  console.log(`Website folder: ${state.workspace.websiteRoot || 'Not configured'}`);
  console.log(`JSON target: ${state.workspace.exportRelativePath || DEFAULT_EXPORT_RELATIVE_PATH}`);
  console.log(`Last fetch: ${state.workspace.lastFetchedAt || 'Never'}`);
}

async function fetchGitHub() {
  line();
  console.log('FETCH GITHUB REPOSITORIES');
  divider();
  const auth = getGitHubToken();
  let username = '';
  if (auth.token) {
    console.log(`Authentication found through ${auth.source}.`);
    console.log('The token will be used only for this request; RepoPilot does not save it.');
  } else {
    console.log('No GitHub authentication was found. This fetch will include public repositories only.');
    username = await ask('GitHub username');
    if (!username) return;
  }

  console.log('Contacting GitHub and retrieving repository metadata...');
  const result = await fetchRepositories({ username, token: auth.token });
  const existing = new Map(state.workspace.repositories.map((repo) => [repo.fullName, repo]));
  const merged = result.repositories.map((repo) => ({ ...existing.get(repo.fullName), ...repo }));
  state.workspace.repositories = merged;
  state.workspace.githubAccount = result.account;
  state.workspace.lastFetchedAt = new Date().toISOString();
  ensureRepositoryMetadata();
  await persist();

  line();
  console.log(`Fetched ${merged.length} repositories for ${result.account}.`);
  console.log('Public repositories are included by default; private repositories are excluded by default.');
  console.log("Use Review projects to set each project's purpose, domain, stage, and website visibility.");
}

function listProjects() {
  const rows = [];
  state.workspace.repositories.forEach((repo) => {
    const meta = currentMetadata(repo);
    rows.push({
      key: repo.fullName,
      name: meta.displayName || repo.name,
      purpose: meta.purpose || repo.description || '',
      domain: meta.domain,
      stage: meta.stage,
      private: repo.private,
      include: Boolean(meta.include),
      manual: false,
      repo,
    });
  });
  state.workspace.manualProjects.forEach((project) => rows.push({
    key: project.id,
    name: project.displayName || project.name,
    purpose: project.purpose || '',
    domain: project.domain,
    stage: project.stage,
    private: Boolean(project.private),
    include: Boolean(project.include),
    manual: true,
    project,
  }));
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

function displayProjectList() {
  const projects = listProjects();
  if (!projects.length) {
    console.log('No projects yet. Fetch GitHub repositories or add a manual project.');
    return projects;
  }
  line();
  console.log(' #  WEBSITE  VISIBILITY  DOMAIN                         PROJECT');
  divider();
  projects.forEach((project, index) => {
    const included = project.include ? 'YES' : 'NO ';
    const visibility = project.private ? 'PRIVATE' : 'PUBLIC ';
    console.log(`${String(index + 1).padStart(2)}  ${included.padEnd(7)}  ${visibility.padEnd(8)}  ${project.domain.padEnd(29)}  ${project.name}`);
  });
  return projects;
}

async function editProject() {
  const projects = displayProjectList();
  if (!projects.length) return;
  const number = Number(await ask('Enter project number to edit (0 to cancel)', '0'));
  if (!number) return;
  if (!Number.isInteger(number) || number < 1 || number > projects.length) {
    console.log('Invalid project number.');
    return;
  }
  const selected = projects[number - 1];
  const current = selected.manual ? selected.project : currentMetadata(selected.repo);
  line();
  console.log(`EDIT PROJECT: ${selected.name}`);
  const displayName = await ask('Display name', current.displayName || selected.name);
  const purpose = await ask('Purpose / short description', current.purpose || selected.purpose || '');
  const domain = await ask('Domain (choose a suggested value or enter your own)', current.domain || 'Other');
  const stage = await choose('Project stage', STAGES, current.stage || 'Unspecified');
  const homepageUrl = await askClearable('Live website URL', current.homepageUrl || '');
  const featured = await askYesNo('Feature this project?', Boolean(current.featured));
  const include = await askYesNo('Include its metadata in the public website JSON?', Boolean(current.include));

  const patch = { displayName, purpose, domain, stage, homepageUrl, featured, include };
  if (selected.manual) {
    const index = state.workspace.manualProjects.findIndex((project) => project.id === selected.key);
    state.workspace.manualProjects[index] = { ...state.workspace.manualProjects[index], ...patch };
  } else {
    state.workspace.projects[selected.key] = { ...current, ...patch };
  }
  if (selected.private && include) {
    console.log('Privacy reminder: the selected project name and purpose will be published. Private source code and private repository URLs are not exported.');
  }
  await persist();
  console.log('Project details saved locally.');
}

async function addManualProject() {
  line();
  console.log('ADD MANUAL PROJECT');
  const name = await ask('Project name');
  if (!name) return;
  const purpose = await ask('Purpose / short description');
  const domain = await ask('Domain', 'Other');
  const stage = await choose('Project stage', STAGES, 'Idea');
  const privateProject = await askYesNo('Is this associated with a private or unpublished repository?', false);
  const repositoryUrl = privateProject ? '' : await ask('Public repository URL (optional)', '');
  const homepageUrl = await ask('Live website URL (optional)', '');
  const include = await askYesNo('Include this project in the public website JSON?', false);
  const id = `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  state.workspace.manualProjects.push({
    id,
    name,
    displayName: name,
    purpose,
    domain,
    stage,
    private: privateProject,
    repositoryUrl,
    homepageUrl,
    featured: false,
    include,
  });
  if (privateProject && include) {
    console.log('Privacy reminder: its name and purpose will appear publicly. No private repository URL or source code is exported.');
  }
  await persist();
  console.log(`Added ${name} to your local RepoPilot workspace.`);
}

function makePreview() {
  const catalogue = buildCatalogue(state.workspace);
  const json = JSON.stringify(catalogue, null, 2);
  line();
  console.log(`JSON PREVIEW — ${catalogue.projects.length} project(s)`);
  divider();
  const lines = json.split('\n');
  console.log(lines.slice(0, 72).join('\n'));
  if (lines.length > 72) console.log(`\n... ${lines.length - 72} more lines. Export to inspect the complete file.`);
  return catalogue;
}

async function configureWebsiteFolder() {
  line();
  console.log('WEBSITE FOLDER');
  console.log('Enter the root folder of the website project (the folder containing package.json).');
  const entered = await ask('Website project folder', state.workspace.websiteRoot || '');
  if (!entered) return false;
  const candidate = path.resolve(entered.replace(/^"|"$/g, ''));
  const stats = await fs.stat(candidate).catch(() => null);
  if (!stats?.isDirectory()) {
    console.log('That folder was not found. RepoPilot has not changed the saved destination.');
    return false;
  }
  const packageJson = await fs.access(path.join(candidate, 'package.json')).then(() => true).catch(() => false);
  if (!packageJson) {
    const proceed = await askYesNo('No package.json was found there. Use this folder anyway?', false);
    if (!proceed) return false;
  }
  state.workspace.websiteRoot = candidate;
  const relative = await ask('JSON path inside that website folder', state.workspace.exportRelativePath || DEFAULT_EXPORT_RELATIVE_PATH);
  state.workspace.exportRelativePath = assertRelativePath(relative || DEFAULT_EXPORT_RELATIVE_PATH);
  await persist();
  console.log(`Saved website folder: ${candidate}`);
  console.log(`Catalogue path: ${state.workspace.exportRelativePath}`);
  return true;
}

async function exportCatalogue() {
  if (!state.workspace.websiteRoot) {
    const configured = await configureWebsiteFolder();
    if (!configured) return null;
  }
  const catalogue = buildCatalogue(state.workspace);
  if (!catalogue.projects.length) {
    console.log('There are no selected projects to export. Review projects and enable Include first.');
    return null;
  }
  const privateCount = countPrivateIncluded(state.workspace);
  if (privateCount) {
    line();
    console.log(`PRIVACY WARNING: ${privateCount} selected project(s) are associated with private repositories.`);
    console.log('Their private repository URL, owner/repository identifier, topics, and GitHub metrics will not be exported. Their display name, purpose, domain, stage, and explicitly entered website URL will be public.');
    if (!await askYesNo('Continue with these selected private-project descriptions?', false)) return null;
  }
  const outputPath = path.join(state.workspace.websiteRoot, state.workspace.exportRelativePath);
  const proceed = await askYesNo(`Write ${catalogue.projects.length} project(s) to ${outputPath}?`, true);
  if (!proceed) return null;
  await writeJson(outputPath, catalogue);
  console.log(`Exported ${catalogue.projects.length} project(s): ${outputPath}`);
  return outputPath;
}

async function publishToWebsite() {
  let outputPath = path.join(state.workspace.websiteRoot || '', state.workspace.exportRelativePath || DEFAULT_EXPORT_RELATIVE_PATH);
  const exists = state.workspace.websiteRoot && await fs.access(outputPath).then(() => true).catch(() => false);
  if (!exists) {
    const created = await exportCatalogue();
    if (!created) return;
    outputPath = created;
  }
  const result = await publishCatalogue({
    websiteRoot: state.workspace.websiteRoot,
    exportRelativePath: state.workspace.exportRelativePath,
    confirm: (message) => askYesNo(message, false),
    askCommitMessage: () => ask('Commit message', 'Update project catalogue'),
  });
  if (result.pushed) {
    console.log(`Published ${result.relativeGitPath} to ${result.remote}/${result.branch}.`);
    console.log('If this is Vercel’s configured Production Branch, Vercel will start a deployment.');
  }
}

async function main() {
  state = await loadWorkspace();
  console.log('');
  console.log('RepoPilot — Local GitHub Project Catalogue');
  divider();
  console.log('Fetch repositories, add project context, review JSON, and publish only when you approve.');
  console.log('Tokens are never saved. Private repositories are excluded by default.');
  ensureRepositoryMetadata();

  let running = true;
  while (running) {
    line();
    printSummary();
    line();
    console.log('  1. Fetch / refresh GitHub repositories');
    console.log('  2. Review or edit project details');
    console.log('  3. Add a manual project (planned / private / unpublished)');
    console.log('  4. Preview the website JSON');
    console.log('  5. Export JSON to the website folder');
    console.log('  6. Commit and push the JSON to the website GitHub repository');
    console.log('  7. Configure website folder');
    console.log('  0. Exit');
    const choice = await ask('Select an option', '1');
    try {
      switch (choice) {
        case '1': await fetchGitHub(); break;
        case '2': await editProject(); break;
        case '3': await addManualProject(); break;
        case '4': makePreview(); break;
        case '5': await exportCatalogue(); break;
        case '6': await publishToWebsite(); break;
        case '7': await configureWebsiteFolder(); break;
        case '0': running = false; break;
        default: console.log('Choose one of the listed options.');
      }
    } catch (error) {
      line();
      console.error(`RepoPilot: ${error.message}`);
    }
  }
  await persist();
  line();
  console.log('RepoPilot closed. Your local project details remain on this computer.');
  rl.close();
}

main().catch((error) => {
  console.error(`RepoPilot could not start: ${error.message}`);
  rl.close();
  process.exitCode = 1;
});
