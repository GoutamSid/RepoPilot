# RepoPilot

RepoPilot is a small, local Node.js tool for turning GitHub repository information into a reviewed project catalogue (`projects.json`). It is designed to run on your own computer; it does not require a hosted sync server or a paid backend.

## What it does

- Fetches public repositories for a GitHub username.
- Uses an existing GitHub CLI login (`gh auth`) or `GITHUB_TOKEN` to fetch repositories owned by the authenticated account, including private repositories the token can read.
- Lets you add a short purpose, domain, stage, homepage, and featured setting to each project.
- Supports manual entries for planned, unpublished, or private projects.
- Excludes private projects by default and requires an extra confirmation before exporting selected private-project descriptions.
- Exports a JSON catalogue to a folder you choose.
- Can optionally commit and push only the generated JSON file to the selected website repository.

RepoPilot does not publish source code, store GitHub tokens, or infer that a repository is working or deployed merely because it exists.

## Requirements

- Windows, macOS, or Linux
- Node.js 20 or newer
- Git, if you want to use the optional commit-and-push action
- GitHub CLI (`gh`) is optional; it provides a convenient local login for private-repository discovery

No `npm install` is required. RepoPilot uses Node.js built-in modules only. The project is released under the MIT License.

## Start on Windows

1. Download or clone this repository.
2. Open the `RepoPilot` folder in VS Code.
3. Double-click `Start-RepoPilot.bat`, or run `npm start` in the VS Code terminal.
4. Choose **Fetch / refresh GitHub repositories**.
5. Review each project and add a useful purpose and domain.
6. Configure your website folder once. The default output path is `public/data/projects.json`.
7. Preview the JSON, then export it.
8. Use the optional publish action only after checking the generated file and confirming the Git push.

In VS Code, you can also open **Terminal → Run Task → RepoPilot: Open local manager**. To run the built-in checks, use `npm test`.

## GitHub access

Without authentication, RepoPilot asks for a GitHub username and reads public repositories only.

For private repositories, install and sign in to the official [GitHub CLI](https://cli.github.com/), then run `gh auth login`. RepoPilot obtains a short-lived token through `gh auth token` when it runs; it does not save the token. Alternatively, set `GITHUB_TOKEN` in the terminal environment before starting RepoPilot. Use a token with read-only access to repository metadata and the repositories you intend to inspect.

The token must never be committed to this repository or placed in the generated JSON.

## Local data and privacy

RepoPilot stores repository snapshots and edited project information in `.repopilot/` on the local computer. That directory is ignored by Git and can contain private repository names, so do not remove it from `.gitignore` or commit it.

Private repositories are excluded from JSON by default. When you explicitly include a private project, RepoPilot exports only the curated display name, purpose, domain, stage, and any website URL you entered. It does not export the private repository URL, owner/repository identifier, topics, or GitHub metrics. Even a project name or purpose may be confidential, so review the preview before exporting.

## Publishing to a website repository

The export destination must be the root of a website Git repository. RepoPilot writes the JSON file (default: `public/data/projects.json`). The optional publish action:

1. Checks that the website folder is a Git repository root.
2. Stops if other changes are already staged.
3. Stages only the generated JSON file.
4. Shows the branch and asks for confirmation.
5. Commits and pushes only that JSON file.

A push triggers a deployment only when the website repository is connected to a deployment provider and the pushed branch is configured for production. The website itself must also be coded to read `/data/projects.json`; exporting the file alone does not add projects to a page that still uses hard-coded project data.

## Project data format

The exported JSON has this top-level structure:

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-11-04T00:00:00.000Z",
  "projects": [
    {
      "id": "github-owner-repository",
      "name": "Example project",
      "purpose": "A concise explanation of what it does.",
      "domain": "Education & Learning",
      "stage": "In development",
      "source": "github",
      "repositoryUrl": "https://github.com/owner/repository",
      "homepageUrl": "",
      "featured": false,
      "visibility": "public",
      "language": "TypeScript",
      "topics": ["education", "learning"],
      "stars": 0,
      "forks": 0,
      "updatedAt": "2026-10-01T00:00:00Z",
      "archived": false
    }
  ]
}
```

The exact set of fields differs for manually added and explicitly selected private projects, to avoid disclosing private repository identifiers and metadata.

## Current limitations

- Repository discovery is manual: it runs when you open RepoPilot and choose Fetch.
- Repository presence and recent commits do not prove functionality, successful tests, or deployment.
- This starter does not run project builds or tests, verify live URLs, or inspect application features.
- The website must be integrated with the JSON contract before the catalogue appears on the live page.
