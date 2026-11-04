# RepoPilot

RepoPilot is a small local tool. It scans the folder that holds your projects, reads a `project.json` file in each project folder, and writes one JSON file for your website.

It runs only on your computer. It does not use GitHub, does not log in anywhere, and does not commit or push anything. You review the generated file in VS Code and commit it yourself.

## Start

- Requires Node.js 20 or newer. There is no install step.
- Double-click `Start-RepoPilot.bat`, or run `npm start`.
- Your browser opens RepoPilot at http://127.0.0.1:4173. Keep the window open while you use it.

## Use

1. Choose your **projects folder** (the folder that contains your project folders).
2. Choose your **website folder** and the JSON path inside it (default `public/data/projects.json`).
3. Each project folder appears in the list. Edit its details and tick **Show on website** for what should appear.
4. Click **Preview JSON** to check the output, then **Write to website**.
5. Review the file in VS Code, then commit and deploy as usual.

## project.json

Each project folder has one file named `project.json`:

```json
{
  "name": "Example Project",
  "description": "One or two sentences about what it does.",
  "section": "Projects",
  "stage": "In development",
  "website": "",
  "featured": false,
  "show": true
}
```

- `stage` must be one of: `Idea`, `In development`, `Completed`, `Archived`.
- `section` decides which group on your website the project appears in. Leave it empty to use `Projects`.
- `show` controls whether the project is written to the website JSON.

Folders without a `project.json` are listed with a **Create project.json** button.

## Website JSON

```json
{
  "schemaVersion": 2,
  "generatedAt": "2026-11-04T10:00:00.000Z",
  "sections": {
    "Education": [
      {
        "id": "example-project",
        "name": "Example Project",
        "description": "One or two sentences about what it does.",
        "stage": "In development",
        "website": "",
        "featured": false
      }
    ]
  }
}
```

Only projects with `show` turned on are included. Folder names and local paths are not written to this file.

## Local files and privacy

- Settings are saved in `.repopilot/settings.json`, which is git-ignored.
- RepoPilot writes only when you click **Save** on a project or **Write to website**.
- The page is served only on your own computer (127.0.0.1).

## Tests

```
npm test
```
