import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scanChanges, scanRepositoryFiles } from '../src/scanner.js';

test('scanner passes clean diff with normal modifications', () => {
  const changedFiles = [
    { status: 'M', path: 'src/components/Header.tsx' }
  ];
  const diffText = `
diff --git a/src/components/Header.tsx b/src/components/Header.tsx
--- a/src/components/Header.tsx
+++ b/src/components/Header.tsx
@@ -1,3 +1,3 @@
-export const title = "Old Title";
+export const title = "New Title";
`;

  const result = scanChanges(changedFiles, diffText);
  assert.equal(result.hasWarnings, false);
  assert.equal(result.hasCritical, false);
  assert.equal(result.hasNewFiles, false);
});

test('scanner flags newly added files', () => {
  const changedFiles = [
    { status: 'A', path: 'src/utils/math.ts' }
  ];
  const diffText = `
diff --git a/src/utils/math.ts b/src/utils/math.ts
new file mode 100644
+++ b/src/utils/math.ts
@@ -0,0 +1,3 @@
+export function add(a, b) { return a + b; }
`;

  const result = scanChanges(changedFiles, diffText);
  assert.equal(result.hasNewFiles, true);
  assert.equal(result.newFiles.length, 1);
  assert.equal(result.newFiles[0], 'src/utils/math.ts');
  assert.equal(result.hasWarnings, false);
});

test('scanner detects .vscode/tasks.json with folderOpen auto-trigger', () => {
  const changedFiles = [
    { status: 'A', path: '.vscode/tasks.json' }
  ];
  const diffText = `
diff --git a/.vscode/tasks.json b/.vscode/tasks.json
new file mode 100644
+++ b/.vscode/tasks.json
@@ -0,0 +1,5 @@
+{
+  "runOptions": {
+    "runOn": "folderOpen"
+  }
+}
`;

  const result = scanChanges(changedFiles, diffText);
  assert.equal(result.hasCritical, true);
  const types = result.warnings.map(w => w.type);
  assert.ok(types.includes('HIGH_RISK_NEW_FILE'));
  assert.ok(types.includes('VSCODE_AUTORUN_TASK'));
});

test('scanner detects package.json script tampering', () => {
  const changedFiles = [
    { status: 'M', path: 'package.json' }
  ];
  const diffText = `
diff --git a/package.json b/package.json
--- a/package.json
+++ b/package.json
@@ -5,3 +5,3 @@
-  "build": "tsc -b && vite build",
+  "build": "node init && tsc -b && vite build",
`;

  const result = scanChanges(changedFiles, diffText);
  assert.equal(result.hasCritical, true);
  const types = result.warnings.map(w => w.type);
  assert.ok(types.includes('SUSPICIOUS_PACKAGE_SCRIPT'));
});

test('scanner detects .gitignore sabotage removing .env', () => {
  const changedFiles = [
    { status: 'M', path: '.gitignore' }
  ];
  const diffText = `
diff --git a/.gitignore b/.gitignore
--- a/.gitignore
+++ b/.gitignore
@@ -22,3 +22,2 @@
-.env
 dist
`;

  const result = scanChanges(changedFiles, diffText);
  assert.equal(result.hasWarnings, true);
  const types = result.warnings.map(w => w.type);
  assert.ok(types.includes('GITIGNORE_SABOTAGE'));
});

test('scanner detects off-screen horizontal whitespace padding', () => {
  const padding = ' '.repeat(50);
  const maliciousLine = `console.log("hello");${padding}evilPayload();`.padEnd(300, ' ');
  const changedFiles = [
    { status: 'M', path: 'eslint.config.js' }
  ];
  const diffText = `
diff --git a/eslint.config.js b/eslint.config.js
--- a/eslint.config.js
+++ b/eslint.config.js
@@ -80,1 +80,1 @@
+${maliciousLine}
`;

  const result = scanChanges(changedFiles, diffText);
  assert.equal(result.hasCritical, true);
  const types = result.warnings.map(w => w.type);
  assert.ok(types.includes('OFF_SCREEN_PADDING'));
});

test('scanner detects obfuscated dynamic evaluation payload', () => {
  const changedFiles = [
    { status: 'A', path: 'src/fonts/fa-brand-400.orc' }
  ];
  const payload = 'var a = splitLane("xyz"); var d = new TextDecoder(); Function("", "run()")();'.repeat(3);
  const diffText = `
diff --git a/src/fonts/fa-brand-400.orc b/src/fonts/fa-brand-400.orc
new file mode 100644
+++ b/src/fonts/fa-brand-400.orc
@@ -0,0 +1,1 @@
+${payload}
`;

  const result = scanChanges(changedFiles, diffText);
  assert.equal(result.hasWarnings, true);
  const types = result.warnings.map(w => w.type);
  assert.ok(types.includes('SUSPICIOUS_EXTENSION'));
  assert.ok(types.includes('OBFUSCATED_PAYLOAD'));
  assert.ok(types.includes('DYNAMIC_CODE_EXECUTION'));
});

test('scanRepositoryFiles passes clean repository', () => {
  const allFiles = ['src/index.ts', 'src/App.tsx', 'package.json', 'README.md'];
  const getFileContent = (file) => {
    if (file === 'package.json') return JSON.stringify({ scripts: { build: 'vite build' } });
    return 'export default function() {}';
  };

  const result = scanRepositoryFiles(allFiles, getFileContent);
  assert.equal(result.hasWarnings, false);
  assert.equal(result.hasCritical, false);
});

test('scanRepositoryFiles detects malicious .vscode/tasks.json and init in repository', () => {
  const allFiles = [
    'src/index.ts',
    '.vscode/tasks.json',
    'init',
    'src/fonts/fa-brand-400.orc'
  ];
  const getFileContent = (file) => {
    if (file === '.vscode/tasks.json') return JSON.stringify({ runOptions: { runOn: 'folderOpen' } });
    if (file === 'init') return 'const path = require("path");';
    if (file.endsWith('.orc')) return 'splitLane("test")';
    return '';
  };

  const result = scanRepositoryFiles(allFiles, getFileContent);
  assert.equal(result.hasCritical, true);
  const types = result.warnings.map(w => w.type);
  assert.ok(types.includes('HIGH_RISK_FILE'));
  assert.ok(types.includes('VSCODE_AUTORUN_TASK'));
  assert.ok(types.includes('UNCONVENTIONAL_ROOT_FILE'));
  assert.ok(types.includes('SUSPICIOUS_EXTENSION'));
});
