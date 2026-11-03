import fs from 'node:fs';
import path from 'node:path';
import { spawnSync, execSync } from 'node:child_process';
import { banner, colors, logInfo, logSuccess, logWarning, logDanger, askQuestion } from './ui.js';
import { scanRepositoryFiles } from './scanner.js';

export async function cloneMain(argv = process.argv.slice(2)) {
  const flags = {
    help: argv.includes('--help') || argv.includes('-h'),
    version: argv.includes('--version') || argv.includes('-v'),
    force: argv.includes('--force') || argv.includes('-y'),
    dryRun: argv.includes('--dry-run')
  };

  if (flags.help) {
    showCloneHelp();
    return;
  }

  // Filter out flag arguments to get positional args (repoUrl, targetDir)
  const args = argv.filter((a) => !a.startsWith('-'));
  if (args.length === 0) {
    showCloneHelp();
    process.exit(1);
  }

  const repoUrl = args[0];
  let targetDir = args[1];

  if (!targetDir) {
    // Derive directory name from URL (e.g., "https://github.com/user/my-repo.git" -> "my-repo")
    const cleanUrl = repoUrl.replace(/\/+$/, '');
    const basename = path.basename(cleanUrl);
    targetDir = basename.endsWith('.git') ? basename.slice(0, -4) : basename;
  }

  const absoluteTargetDir = path.resolve(process.cwd(), targetDir);

  banner();
  console.log(`${colors.cyan}⬇  Cloning repository safely (--no-checkout)...${colors.reset}`);
  logInfo(`Repository: ${colors.bold}${repoUrl}${colors.reset}`);
  logInfo(`Destination: ${colors.bold}${targetDir}${colors.reset} (Workspace remains empty until verified)\n`);

  // 1. Safe Clone (--no-checkout: git metadata only, zero files written to disk)
  const cloneResult = spawnSync('git', ['clone', '--no-checkout', repoUrl, targetDir], {
    stdio: 'inherit'
  });

  if (cloneResult.status !== 0) {
    logDanger('git clone failed.');
    process.exit(1);
  }

  // 2. Inspect Repository Files in Memory via git ls-tree and git show
  logInfo('Running pre-checkout security inspection on repository files...\n');

  let allFiles = [];
  try {
    const rawFiles = execSync('git ls-tree -r --name-only HEAD', {
      cwd: absoluteTargetDir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    allFiles = rawFiles.split('\n').map((f) => f.trim()).filter(Boolean);
  } catch (err) {
    logWarning('Could not list tree (repository might be empty). Checking out...');
    spawnSync('git', ['checkout'], { cwd: absoluteTargetDir, stdio: 'inherit' });
    return;
  }

  const getFileContent = (filepath) => {
    try {
      return execSync(`git show HEAD:"${filepath}"`, {
        cwd: absoluteTargetDir,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
    } catch {
      return null;
    }
  };

  const analysis = scanRepositoryFiles(allFiles, getFileContent);

  // 3. Evaluation
  if (analysis.hasWarnings) {
    console.log(`\n${colors.bgRed}${colors.bold} 🚨 SECURITY THREATS DETECTED IN REPOSITORY! ${colors.reset}\n`);
    logDanger(`Found ${analysis.warnings.length} security warning(s) in this repository BEFORE checkout:`);

    analysis.warnings.forEach((w) => {
      const badge =
        w.level === 'CRITICAL'
          ? `${colors.bgRed}${colors.bold} CRITICAL ${colors.reset}`
          : `${colors.yellow}${colors.bold} HIGH ${colors.reset}`;
      console.log(`  ${badge} ${colors.bold}${w.file}${colors.reset}`);
      console.log(`     ${colors.dim}↳ ${w.message}${colors.reset}`);
    });
    console.log('');

    if (flags.dryRun) {
      logInfo('Dry run mode enabled. Deleting temporary clone and exiting.');
      fs.rmSync(absoluteTargetDir, { recursive: true, force: true });
      return;
    }

    if (flags.force) {
      logWarning('--force flag detected. Checking out files despite warnings.');
    } else {
      while (true) {
        const action = await askQuestion(
          `Security action: [${colors.red}a${colors.reset}] Abort and safely delete repo (recommended), [${colors.green}c${colors.reset}] Checkout anyway, [${colors.cyan}l${colors.reset}] List files [a/c/l]:`
        );

        const choice = (action || '').toLowerCase();

        if (choice === 'l') {
          console.log(`\n${colors.bold}Files in repository (${allFiles.length}):${colors.reset}`);
          allFiles.forEach((f) => console.log(`  • ${f}`));
          console.log('');
        } else if (choice === 'c') {
          break;
        } else {
          // Default: Abort and delete
          console.log(`\n${colors.yellow}Cleaning up and removing ${targetDir}...${colors.reset}`);
          fs.rmSync(absoluteTargetDir, { recursive: true, force: true });
          logSuccess('Cloned repository deleted safely. Not a single file ever touched your workspace!');
          process.exit(1);
        }
      }
    }
  } else {
    logSuccess(`Security scan clean! All ${allFiles.length} repository files verified safe.`);
  }

  // 4. Safe Checkout
  console.log(`\n${colors.cyan}Extracting files to disk...${colors.reset}`);
  const checkoutResult = spawnSync('git', ['checkout'], {
    cwd: absoluteTargetDir,
    stdio: 'inherit'
  });

  if (checkoutResult.status === 0) {
    logSuccess(`Repository cloned safely to ${colors.bold}${targetDir}${colors.reset}!`);
  } else {
    logDanger('git checkout failed.');
    process.exit(1);
  }
}

function showCloneHelp() {
  console.log(`
${colors.bold}git-safe-clone${colors.reset} — Pre-checkout Security Clone

${colors.bold}USAGE:${colors.reset}
  git-safe-clone <repository-url> [directory] [options]
  git safe-clone <repository-url> [directory] [options]  (when configured as Git alias)

${colors.bold}OPTIONS:${colors.reset}
  -y, --force     Skip confirmation prompts and checkout automatically
  --dry-run       Clone and scan without writing files to disk (auto-deletes after scan)
  -h, --help      Display this help message
  -v, --version   Display version

${colors.bold}HOW IT PROTECTS YOU:${colors.reset}
  1. Clones using '--no-checkout' (zero files touch your disk initially)
  2. Inspects all repository files, configs, and scripts in memory
  3. If malware/auto-tasks are detected, prompts to safely DELETE the repository
  4. Only writes files to disk if verified clean or approved by you
`);
}
