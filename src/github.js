import { execFileSync } from 'node:child_process';

const API_ROOT = 'https://api.github.com';

function tokenFromGitHubCli() {
  try {
    return execFileSync('gh', ['auth', 'token'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
      timeout: 5000,
    }).trim() || null;
  } catch {
    return null;
  }
}

export function getGitHubToken() {
  const environmentToken = process.env.GITHUB_TOKEN?.trim();
  if (environmentToken) return { token: environmentToken, source: 'GITHUB_TOKEN environment variable' };
  const cliToken = tokenFromGitHubCli();
  if (cliToken) return { token: cliToken, source: 'GitHub CLI authentication' };
  return { token: null, source: null };
}

function parseNextLink(linkHeader) {
  if (!linkHeader) return null;
  for (const part of linkHeader.split(',')) {
    const match = part.match(/<([^>]+)>;\s*rel="next"/);
    if (match) return match[1];
  }
  return null;
}

async function githubRequest(url, token) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'RepoPilot-local-project-catalogue',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(url, { headers });
  if (!response.ok) {
    let detail = '';
    try {
      const body = await response.json();
      detail = body.message || '';
    } catch {
      // Keep the HTTP status when GitHub does not return JSON.
    }
    const suffix = detail ? ` — ${detail}` : '';
    if (response.status === 401 || response.status === 403) {
      throw new Error(`GitHub rejected the request (${response.status})${suffix}. Check authentication and repository read permission.`);
    }
    if (response.status === 404) {
      throw new Error(`GitHub account or endpoint was not found (${response.status})${suffix}. Check the username.`);
    }
    throw new Error(`GitHub API request failed (${response.status})${suffix}`);
  }
  return response;
}

async function fetchAllPages(firstUrl, token) {
  const all = [];
  let url = firstUrl;
  while (url) {
    const response = await githubRequest(url, token);
    const page = await response.json();
    if (!Array.isArray(page)) throw new Error('GitHub returned an unexpected repository response.');
    all.push(...page);
    url = parseNextLink(response.headers.get('link'));
  }
  return all;
}

export function normalizeRepository(repo) {
  return {
    id: repo.id,
    fullName: repo.full_name,
    name: repo.name,
    owner: repo.owner?.login || '',
    description: repo.description || '',
    private: Boolean(repo.private),
    htmlUrl: repo.html_url || '',
    homepage: repo.homepage || '',
    language: repo.language || '',
    topics: Array.isArray(repo.topics) ? repo.topics : [],
    stars: Number(repo.stargazers_count || 0),
    forks: Number(repo.forks_count || 0),
    createdAt: repo.created_at || null,
    updatedAt: repo.updated_at || null,
    pushedAt: repo.pushed_at || null,
    archived: Boolean(repo.archived),
    disabled: Boolean(repo.disabled),
    defaultBranch: repo.default_branch || 'main',
  };
}

export async function fetchRepositories({ username = '', token = null } = {}) {
  let account = username.trim();
  let url;

  if (token) {
    const userResponse = await githubRequest(`${API_ROOT}/user`, token);
    const user = await userResponse.json();
    account = user.login;
    const params = new URLSearchParams({
      affiliation: 'owner',
      visibility: 'all',
      sort: 'updated',
      per_page: '100',
    });
    url = `${API_ROOT}/user/repos?${params.toString()}`;
  } else {
    if (!account) throw new Error('Enter a GitHub username to fetch public repositories.');
    const params = new URLSearchParams({
      type: 'owner',
      sort: 'updated',
      per_page: '100',
    });
    url = `${API_ROOT}/users/${encodeURIComponent(account)}/repos?${params.toString()}`;
  }

  const rawRepositories = await fetchAllPages(url, token);
  const repositories = rawRepositories
    .filter((repo) => repo.owner?.login?.toLowerCase() === account.toLowerCase())
    .map(normalizeRepository)
    .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));

  return { account, repositories, authenticated: Boolean(token) };
}
