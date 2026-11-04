import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { setDataDir } from '../src/storage.js';
import {
  ActionError,
  buildPreview,
  createTemplate,
  currentState,
  saveProject,
  setFolder,
  setOutputPath,
  writeWebsiteFile,
} from '../src/actions.js';

const ELECTRON_DIR = path.dirname(fileURLToPath(import.meta.url));
const PICKER_DESCRIPTIONS = {
  projects: 'Choose the folder that contains your project folders',
  website: 'Choose your website project folder',
};

async function pickFolder(kind, win) {
  const description = PICKER_DESCRIPTIONS[kind];
  if (!description) throw new ActionError(400, 'Unknown folder type.');
  const result = await dialog.showOpenDialog(win, {
    title: description,
    properties: ['openDirectory', 'createDirectory'],
  });
  return { path: result.canceled ? '' : result.filePaths[0] };
}

const HANDLERS = {
  state: () => currentState(),
  preview: () => buildPreview(),
  'pick-folder': (body, win) => pickFolder(body?.kind, win),
  folder: (body) => setFolder(body?.kind, body?.path),
  output: (body) => setOutputPath(body?.outputRelativePath),
  project: (body) => saveProject(body?.folder, body?.value),
  template: (body) => createTemplate(body?.folder),
  write: () => writeWebsiteFile(),
};

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 820,
    autoHideMenuBar: true,
    backgroundColor: '#f6f8fa',
    webPreferences: {
      preload: path.join(ELECTRON_DIR, 'preload.cjs'),
    },
  });
  win.loadFile(path.join(ELECTRON_DIR, '..', 'web', 'index.html'));
}

app.whenReady().then(() => {
  setDataDir(app.getPath('userData'));

  ipcMain.handle('repopilot', async (event, channel, body) => {
    const handler = HANDLERS[channel];
    if (!handler) return { ok: false, error: 'Unknown request.' };
    try {
      const win = BrowserWindow.fromWebContents(event.sender);
      return { ok: true, value: await handler(body, win) };
    } catch (error) {
      return { ok: false, error: error.message || 'Something went wrong.' };
    }
  });

  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
