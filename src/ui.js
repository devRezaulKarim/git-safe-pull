// Simple zero-dependency ANSI color helpers and UI formatting
import readline from 'node:readline';

const isColorSupported = !process.env.NO_COLOR && (process.stdout.isTTY || process.env.FORCE_COLOR);

export const colors = {
  reset: isColorSupported ? '\x1b[0m' : '',
  bold: isColorSupported ? '\x1b[1m' : '',
  dim: isColorSupported ? '\x1b[2m' : '',
  red: isColorSupported ? '\x1b[31m' : '',
  green: isColorSupported ? '\x1b[32m' : '',
  yellow: isColorSupported ? '\x1b[33m' : '',
  blue: isColorSupported ? '\x1b[34m' : '',
  magenta: isColorSupported ? '\x1b[35m' : '',
  cyan: isColorSupported ? '\x1b[36m' : '',
  bgRed: isColorSupported ? '\x1b[41m\x1b[37m' : '',
  bgYellow: isColorSupported ? '\x1b[43m\x1b[30m' : '',
  bgGreen: isColorSupported ? '\x1b[42m\x1b[30m' : ''
};

export function banner() {
  console.log(`\n${colors.cyan}${colors.bold}🛡️  git-safe-pull${colors.reset} ${colors.dim}v1.0.0 — Pre-merge Security & File Inspector${colors.reset}\n`);
}

export function logInfo(msg) {
  console.log(`${colors.blue}ℹ${colors.reset} ${msg}`);
}

export function logSuccess(msg) {
  console.log(`${colors.green}✔${colors.reset} ${colors.bold}${msg}${colors.reset}`);
}

export function logWarning(msg) {
  console.log(`${colors.yellow}⚠${colors.reset} ${msg}`);
}

export function logDanger(msg) {
  console.log(`${colors.red}✖${colors.reset} ${colors.bold}${msg}${colors.reset}`);
}

export function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(`${colors.bold}${query}${colors.reset} `, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}
