import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { assertRelativePath } from './storage.js';

function git(args, cwd) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
  });
  if (result.error) throw new Error(`Could not run Git: ${result.error.message}. Is Git installed and available in PATH?`);
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || '').trim();
    throw new Error(`Git command failed: git ${args.join(' ')}\n${detail}`);
  }
  return (result.stdout || '').trim();
}

export async function publishCatalogue({ websiteRoot, exportRelativePath, confirm, askCommitMessage }) {
  const root = path.resolve(websiteRoot);
  const safeRelativePath = assertRelativePath(exportRelativePath);
  const outputPath = path.join(root, safeRelativePath);
  await fs.access(outputPath);

  const gitRoot = git(['rev-parse', '--show-toplevel'], root);
  const resolvedGitRoot = path.resolve(gitRoot);
  if (resolvedGitRoot.toLowerCase() !== root.toLowerCase()) {
    throw new Error(`The selected website folder is not the Git repository root. Git root detected: ${resolvedGitRoot}`);
  }

  const relativeGitPath = path.relative(root, outputPath).split(path.sep).join('/');
  const alreadyStaged = git(['diff', '--cached', '--name-only'], root)
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);
  if (alreadyStaged.length) {
    throw new Error(`Publishing stopped because your website repository already has staged changes:\n${alreadyStaged.join('\n')}\nCommit or unstage those changes yourself, then run RepoPilot again. This safety check prevents RepoPilot from including unrelated work.`);
  }

  const statusBefore = git(['status', '--short', '--', relativeGitPath], root);
  if (!statusBefore) {
    console.log('The exported JSON has no changes to publish. Your website repository is already up to date.');
    return { pushed: false, reason: 'no-changes' };
  }

  git(['add', '--', relativeGitPath], root);
  const stagedPaths = git(['diff', '--cached', '--name-only'], root)
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);
  if (stagedPaths.length !== 1 || stagedPaths[0] !== relativeGitPath) {
    throw new Error(`Safety check failed. Expected only ${relativeGitPath} to be staged, but Git reports:\n${stagedPaths.join('\n') || '(nothing)'}. No commit was created.`);
  }

  const branch = git(['branch', '--show-current'], root);
  if (!branch) throw new Error('Could not determine the current website Git branch.');
  const remote = git(['remote'], root).split(/\r?\n/).filter(Boolean)[0];
  if (!remote) throw new Error('The website Git repository has no remote. Add its GitHub remote before publishing.');

  const message = await askCommitMessage();
  const commitMessage = message.trim() || 'Update project catalogue';
  const approved = await confirm(
    `RepoPilot will commit only ${relativeGitPath} on branch ${branch} and push it to remote ${remote}. If that branch is connected to Vercel's Production Branch, the push will trigger a deployment. Continue?`
  );
  if (!approved) {
    git(['reset', '--', relativeGitPath], root);
    return { pushed: false, reason: 'cancelled' };
  }

  git(['commit', '-m', commitMessage, '--', relativeGitPath], root);
  const upstream = spawnSync('git', ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
  });
  if (upstream.status === 0) {
    git(['push'], root);
  } else {
    git(['push', '--set-upstream', remote, branch], root);
  }

  return { pushed: true, branch, remote, relativeGitPath };
}
