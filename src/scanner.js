/**
 * Security Scanner for Git Diffs & Incoming Files
 */

const SUSPICIOUS_EXTENSIONS = [
  '.orc', '.bat', '.cmd', '.vbs', '.ps1', '.sh', '.exe',
  '.bin', '.dll', '.so', '.dylib', '.msi', '.hta', '.scr'
];

const SUSPICIOUS_PATHS = [
  '.vscode/tasks.json',
  '.vscode/settings.json',
  '.idea/',
  'init'
];

export function scanChanges(changedFiles, diffText) {
  const warnings = [];
  const newFiles = [];

  // 1. Analyze Changed Files & Paths
  for (const file of changedFiles) {
    const isAdded = file.status.startsWith('A');
    const isModified = file.status.startsWith('M');
    const filename = file.path;
    const lowerName = filename.toLowerCase();

    if (isAdded) {
      newFiles.push(filename);

      // Check high risk paths
      if (SUSPICIOUS_PATHS.some((p) => lowerName === p || lowerName.endsWith('/' + p))) {
        warnings.push({
          level: 'CRITICAL',
          type: 'HIGH_RISK_NEW_FILE',
          file: filename,
          message: `Added sensitive configuration file (${filename}) known to be targeted by IDE auto-execution malware.`
        });
      }

      // Check suspicious extensions
      const extMatch = SUSPICIOUS_EXTENSIONS.find((ext) => lowerName.endsWith(ext));
      if (extMatch) {
        warnings.push({
          level: 'HIGH',
          type: 'SUSPICIOUS_EXTENSION',
          file: filename,
          message: `Added file with suspicious script/executable extension (${extMatch}).`
        });
      }

      // Check root files without extensions (e.g., "init")
      if (!filename.includes('/') && !filename.includes('\\') && !filename.includes('.')) {
        warnings.push({
          level: 'HIGH',
          type: 'UNCONVENTIONAL_ROOT_FILE',
          file: filename,
          message: `Added unconventional extension-less file in repository root (${filename}).`
        });
      }
    }
  }

  // 2. Analyze Diff Content Line-by-Line
  if (diffText) {
    const lines = diffText.split('\n');
    let currentFile = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Track current file in diff header
      if (line.startsWith('diff --git ')) {
        const parts = line.split(' ');
        currentFile = parts[3] ? parts[3].replace(/^b\//, '') : '';
        continue;
      }

      // Only inspect added lines in diff (+)
      if (line.startsWith('+') && !line.startsWith('+++')) {
        const content = line.slice(1);

        // Check: Off-screen horizontal whitespace padding (hiding code off-screen)
        if (content.length > 250 && /\s{25,}/.test(content)) {
          warnings.push({
            level: 'CRITICAL',
            type: 'OFF_SCREEN_PADDING',
            file: currentFile,
            line: i + 1,
            message: `Detected hidden off-screen code (>250 chars padded with long horizontal whitespace).`
          });
        }

        // Check: VS Code automatic execution task triggers
        if (/"runOn"\s*:\s*"folderOpen"/i.test(content)) {
          warnings.push({
            level: 'CRITICAL',
            type: 'VSCODE_AUTORUN_TASK',
            file: currentFile,
            line: i + 1,
            message: `Detected VS Code task configured to execute automatically on "folderOpen" without user action!`
          });
        }

        // Check: VS Code automatic task permission
        if (/"task\.allowAutomaticTasks"\s*:\s*true/i.test(content)) {
          warnings.push({
            level: 'HIGH',
            type: 'VSCODE_ALLOW_AUTO_TASKS',
            file: currentFile,
            line: i + 1,
            message: `Detected VS Code setting enabling automatic task execution ("task.allowAutomaticTasks": true).`
          });
        }

        // Check: package.json script modification
        if (currentFile.endsWith('package.json')) {
          if (/(node\s+init|"node\s+[a-zA-Z0-9_\-\.\/]+\.orc"|curl\s+|wget\s+|powershell\s+|certutil\s+)/i.test(content)) {
            warnings.push({
              level: 'CRITICAL',
              type: 'SUSPICIOUS_PACKAGE_SCRIPT',
              file: currentFile,
              line: i + 1,
              message: `Detected suspicious command injected into package.json scripts: "${content.trim()}".`
            });
          }
        }

        // Check: Obfuscation signatures
        if (/\b(splitLane|TextDecoder|fromCharCode)\b/.test(content) && content.length > 150) {
          warnings.push({
            level: 'HIGH',
            type: 'OBFUSCATED_PAYLOAD',
            file: currentFile,
            line: i + 1,
            message: `Detected code reconstruction/de-obfuscation patterns (splitLane/TextDecoder/fromCharCode).`
          });
        }

        // Check: Dynamic evaluation in suspicious contexts
        if (/(\beval\s*\(|new\s+Function\s*\(|Function\s*\(['"`])/.test(content) && content.length > 100) {
          warnings.push({
            level: 'HIGH',
            type: 'DYNAMIC_CODE_EXECUTION',
            file: currentFile,
            line: i + 1,
            message: `Detected dynamic code evaluation (eval / new Function) in added code.`
          });
        }
      }

      // Check: .gitignore removal of .env (lines starting with -)
      if (line.startsWith('-') && !line.startsWith('---')) {
        const removed = line.slice(1).trim();
        if (currentFile.endsWith('.gitignore') && (removed === '.env' || removed === '*.env')) {
          warnings.push({
            level: 'HIGH',
            type: 'GITIGNORE_SABOTAGE',
            file: currentFile,
            line: i + 1,
            message: `Detected removal of .env from .gitignore! (Secrets might be exposed on next commit).`
          });
        }
      }
    }
  }

  return {
    newFiles,
    warnings,
    hasCritical: warnings.some((w) => w.level === 'CRITICAL'),
    hasWarnings: warnings.length > 0,
    hasNewFiles: newFiles.length > 0
  };
}
