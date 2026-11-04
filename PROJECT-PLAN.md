# RepoPilot — scope

## Included
- Local browser interface served on 127.0.0.1 (no install beyond Node.js).
- Scan a chosen projects folder and read each folder's `project.json`.
- Create a `project.json` template for folders that do not have one.
- Edit project details and choose what is shown on the website.
- Preview and write one grouped JSON file to the chosen website folder.

## Not included
- GitHub API access, sign-in, or tokens.
- Git commit, push, or deployment. These stay manual in VS Code.
- Background watching. RepoPilot runs when you start it.
- Website UI. The website must read the JSON file.

## Possible later increments
- Track which projects are new since the last write.
- Reports and dashboard generated from the same folders.
- An Electron wrapper, if the browser page proves inconvenient.
