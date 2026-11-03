import { execSync, spawnSync } from 'node:child_process';

function runGit(args, options = {}) {
  try {
    const result = execSync(`git ${args}`, {
      encoding: 'utf-8',
      stdio: options.stdio || ['pipe', 'pipe', 'pipe'],
      ...options
    });
    return (result || '').trim();
  } catch (error) {
    if (options.ignoreError) return null;
    throw error;
  }
}

export function isGitRepository() {
  try {
    return runGit('rev-parse --is-inside-work-tree', { ignoreError: true }) === 'true';
  } catch {
    return false;
  }
}

export function getCurrentBranch() {
  return runGit('rev-parse --abbrev-ref HEAD');
}

export function getUpstreamBranch() {
  try {
    return runGit('rev-parse --abbrev-ref --symbolic-full-name @{u}', { ignoreError: true });
  } catch {
    return null;
  }
}

export function isWorkingDirectoryClean() {
  const status = runGit('status --porcelain');
  return status.length === 0;
}

export function safeFetch(args = []) {
  const extraArgs = args.length > 0 ? ` ${args.join(' ')}` : '';
  const result = spawnSync('git', ['fetch', ...args], {
    stdio: 'inherit'
  });
  if (result.status !== 0) {
    throw new Error('git fetch failed.');
  }
}

export function getIncomingCommits(upstream) {
  const target = upstream || '@{u}';
  const rawList = runGit(`log --oneline HEAD..${target}`, { ignoreError: true });
  if (!rawList) return [];
  return rawList.split('\n').filter(Boolean);
}

export function getChangedFiles(upstream) {
  const target = upstream || '@{u}';
  const raw = runGit(`diff --name-status HEAD..${target}`, { ignoreError: true });
  if (!raw) return [];
  
  return raw.split('\n').filter(Boolean).map((line) => {
    const parts = line.split('\t');
    const status = parts[0];
    const path = parts[1];
    const oldPath = parts[2] || null;
    return { status, path, oldPath };
  });
}

export function getDiff(upstream) {
  const target = upstream || '@{u}';
  return runGit(`diff HEAD..${target}`, { ignoreError: true }) || '';
}

export function showInteractiveDiff(upstream) {
  const target = upstream || '@{u}';
  spawnSync('git', ['diff', `HEAD..${target}`], {
    stdio: 'inherit'
  });
}

export function performMerge(upstream, allowNonFastForward = false) {
  const target = upstream || '@{u}';
  const args = ['merge'];
  if (!allowNonFastForward) {
    args.push('--ff-only');
  }
  args.push(target);

  const result = spawnSync('git', args, {
    stdio: 'inherit'
  });

  if (result.status !== 0) {
    if (!allowNonFastForward) {
      throw new Error('Fast-forward merge failed. (You may have diverged local commits)');
    }
    throw new Error('Merge encountered conflicts or failed.');
  }
}
