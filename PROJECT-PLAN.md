# RepoPilot — first-stage scope

## Included now
- Local command-line workflow with a Windows batch launcher and VS Code task.
- Public GitHub repository discovery.
- Optional private repository discovery using the user's existing GitHub CLI login or an environment token.
- Local editable project metadata and manual project entries.
- Domain, stage, purpose, featured, and include settings.
- JSON preview and export to a selected website folder.
- Optional guarded Git commit/push of only the exported JSON file.

## Deliberately not included in the first stage
- Always-on background polling or a hosted backend.
- A full Electron desktop installer.
- Automatic claims that code is functional, tested, ready, or deployed.
- Automatic deployment of the tool itself.
- Website UI integration; each consuming website must implement the JSON data contract.

## Possible future increments
- Verify CI checks from GitHub Actions.
- Verify deployment state from the deployment provider or GitHub Deployments API.
- Validate user-entered live URLs.
- Add a graphical interface only if the terminal workflow proves inconvenient.
- Provide a configurable adapter for different portfolio JSON schemas.
