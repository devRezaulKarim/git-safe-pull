import { banner, colors, logInfo, logSuccess, logWarning, logDanger, askQuestion } from './ui.js';
import * as git from './git.js';
import { scanChanges } from './scanner.js';

export async function main(argv = process.argv.slice(2)) {
  const flags = {
    help: argv.includes('--help') || argv.includes('-h'),
    version: argv.includes('--version') || argv.includes('-v'),
    dryRun: argv.includes('--dry-run'),
    force: argv.includes('--force') || argv.includes('-y'),
    showDiff: argv.includes('--diff'),
    strict: argv.includes('--strict')
  };

  if (flags.help) {
    showHelp();
    return;
  }

  if (flags.version) {
    console.log('git-safe-pull v1.0.0');
    return;
  }

  banner();

  // 1. Git Repository Check
  if (!git.isGitRepository()) {
    logDanger('Error: Not inside a Git repository.');
    process.exit(1);
  }

  // 2. Working Tree Cleanliness Check
  if (!git.isWorkingDirectoryClean()) {
    logWarning('Warning: Your local working directory has uncommitted changes.');
  }

  const currentBranch = git.getCurrentBranch();
  logInfo(`Current branch: ${colors.bold}${currentBranch}${colors.reset}`);

  // 3. Upstream Check
  let upstream = git.getUpstreamBranch();
  if (!upstream) {
    logWarning(`No tracking upstream configured for ${colors.bold}${currentBranch}${colors.reset}.`);
    logInfo('Falling back to default remote fetch...');
  }

  // 4. Safe Fetch (Updates git refs without modifying files on disk)
  console.log(`\n${colors.cyan}⬇  Fetching incoming changes safely (workspace untouched)...${colors.reset}`);
  try {
    git.safeFetch();
  } catch (err) {
    logDanger(`Fetch failed: ${err.message}`);
    process.exit(1);
  }

  if (!upstream) {
    upstream = `origin/${currentBranch}`;
  }

  // 5. Incoming Commits Analysis
  const incomingCommits = git.getIncomingCommits(upstream);
  if (incomingCommits.length === 0) {
    logSuccess('Already up to date. No new incoming commits.');
    return;
  }

  console.log(`\n${colors.bold}Incoming Commits (${incomingCommits.length}):${colors.reset}`);
  incomingCommits.slice(0, 10).forEach((commit) => {
    console.log(`  ${colors.dim}•${colors.reset} ${commit}`);
  });
  if (incomingCommits.length > 10) {
    console.log(`  ${colors.dim}... and ${incomingCommits.length - 10} more commits.${colors.reset}`);
  }

  // 6. Security & File Scan
  const changedFiles = git.getChangedFiles(upstream);
  const diffText = git.getDiff(upstream);
  const analysis = scanChanges(changedFiles, diffText);

  // If user requested --diff flag upfront
  if (flags.showDiff) {
    console.log(`\n${colors.bold}--- INCOMING DIFF ---${colors.reset}`);
    git.showInteractiveDiff(upstream);
    console.log(`\n${colors.bold}--- END OF DIFF ---${colors.reset}\n`);
  }

  // 7. Security Evaluation
  const requiresManualReview =
    analysis.hasCritical ||
    analysis.hasWarnings ||
    analysis.hasNewFiles ||
    flags.strict;

  if (requiresManualReview) {
    console.log(`\n${colors.bgYellow}${colors.bold} ⚠️  ATTENTION: MANUAL REVIEW REQUIRED ${colors.reset}\n`);

    // List New Files Added
    if (analysis.hasNewFiles) {
      console.log(`${colors.yellow}${colors.bold}📁 Newly Added Files (${analysis.newFiles.length}):${colors.reset}`);
      analysis.newFiles.forEach((file) => {
        console.log(`  ${colors.green}+${colors.reset} ${file}`);
      });
      console.log('');
    }

    // List Security Alerts
    if (analysis.hasWarnings) {
      console.log(`${colors.red}${colors.bold}🚨 Security Warnings Detected (${analysis.warnings.length}):${colors.reset}`);
      analysis.warnings.forEach((w) => {
        const badge =
          w.level === 'CRITICAL'
            ? `${colors.bgRed}${colors.bold} CRITICAL ${colors.reset}`
            : `${colors.yellow}${colors.bold} HIGH ${colors.reset}`;
        console.log(`  ${badge} ${colors.bold}${w.file}${colors.reset}`);
        console.log(`     ${colors.dim}↳ ${w.message}${colors.reset}`);
      });
      console.log('');
    }

    if (flags.dryRun) {
      logInfo('Dry run mode enabled. Exiting without merging.');
      return;
    }

    if (flags.force) {
      logWarning('--force flag detected. Bypassing manual approval prompt.');
    } else {
      // Interactive Prompt Loop
      let shouldProceed = false;

      while (true) {
        const action = await askQuestion(
          `Review options: [${colors.cyan}v${colors.reset}] View diff, [${colors.green}y${colors.reset}] Approve & merge, [${colors.red}n${colors.reset}] Abort [v/y/n]:`
        );

        const choice = (action || '').toLowerCase();

        if (choice === 'v') {
          console.log(`\n${colors.bold}--- INCOMING DIFF ---${colors.reset}`);
          git.showInteractiveDiff(upstream);
          console.log(`\n${colors.bold}--- END OF DIFF ---${colors.reset}\n`);
        } else if (choice === 'y' || choice === 'yes') {
          shouldProceed = true;
          break;
        } else {
          logDanger('Merge aborted by user. Workspace remains safe and untouched.');
          process.exit(1);
        }
      }

      if (!shouldProceed) {
        process.exit(1);
      }
    }
  } else {
    logSuccess('Security scan clean! No suspicious code patterns or new files detected.');
    if (flags.dryRun) {
      logInfo('Dry run mode enabled. Exiting without merging.');
      return;
    }
  }

  // 8. Perform Merge
  console.log(`\n${colors.cyan}⚡ Merging incoming changes into ${colors.bold}${currentBranch}${colors.reset}...`);
  try {
    git.performMerge(upstream);
    logSuccess(`Successfully merged ${upstream} into ${currentBranch}!`);
  } catch (err) {
    logDanger(`Merge failed: ${err.message}`);
    process.exit(1);
  }
}

function showHelp() {
  console.log(`
${colors.bold}git-safe-pull${colors.reset} — Pre-merge Security & File Inspector

${colors.bold}USAGE:${colors.reset}
  git-safe-pull [options]
  git safe-pull [options]  (when configured as Git alias)

${colors.bold}OPTIONS:${colors.reset}
  -y, --force     Skip confirmation prompts and merge automatically
  --diff          Show incoming diff before prompting
  --dry-run       Fetch and scan changes without merging
  --strict        Require manual approval for any pull, even if clean
  -h, --help      Display this help message
  -v, --version   Display version

${colors.bold}SECURITY CHECKS:${colors.reset}
  • Flags all newly added files before they touch your disk
  • Detects .vscode/tasks.json auto-execution malware ("folderOpen")
  • Detects off-screen horizontally padded malicious code
  • Detects package.json script modifications (e.g. injected init/build hooks)
  • Detects .gitignore tampering (e.g. removing .env)
  • Detects code obfuscation and dynamic evaluation patterns
`);
}
