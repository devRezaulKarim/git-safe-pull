# 🛡️ git-safe-pull & git-safe-clone

> **A safe pre-merge and pre-clone security shield for Git that catches malware, unauthorized new files, and hidden script injections BEFORE they touch your disk.**

[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-success.svg)](package.json)

---

## 🚨 The Threat: Why Standard `git pull` & `git clone` Are Dangerous

In modern developer-targeted supply chain attacks (such as **Lazarus / Contagious Interview** campaigns):

1. **Malicious `.vscode/tasks.json`** files are configured with `"runOn": "folderOpen"`. The millisecond `git pull` or `git clone` writes files to disk, your open VS Code / Cursor editor automatically executes the malware silently in the background.
2. **Hidden Executables**: Attackers disguise scripts inside fonts (e.g. `fa-brand-400.orc`) or root scripts (like `init`).
3. **Off-Screen Padding**: Payloads are appended to files like `eslint.config.js` with hundreds of spaces pushing malicious code off-screen.
4. **Script Tampering**: `package.json` scripts (`"build"`, `"dev"`) are modified to execute hidden scripts.
5. **`.gitignore` Sabotage**: `.env` is removed so secrets are accidentally committed.

This package provides two zero-dependency security tools:
* **`git safe-pull`**: Fetches in memory first, analyzes the incoming diff, and prompts you before any new files or suspicious changes hit your disk.
* **`git safe-clone`**: Clones with `--no-checkout`, inspects all files in memory, and gives you the option to safely delete the repository before malicious files ever touch your disk.

---

## 📦 Installation

### Global Installation via NPM:
```bash
npm install -g git-safe-pull
```

### Install Directly from GitHub:
```bash
npm install -g git+https://github.com/devRezaulKarim/git-safe-pull.git
```

---

## 🚀 Usage

The commands work directly as native Git subcommands **out of the box with zero configuration**. You can use either the full command or the built-in 2-letter shortcuts:

### 1. Safe Pull: `git sp` (or `git safe-pull`)
```bash
# In any Git repository:
git sp

# Or type the full command:
git safe-pull

# Useful Options:
git sp --diff       # Review full incoming diff before merging
git sp --dry-run    # Inspect and scan without merging
git sp --strict     # Require manual approval on any pull, even if clean
```

### 2. Safe Clone: `git sc` (or `git safe-clone`)
```bash
# Clone and verify before files touch your disk:
git sc https://github.com/user/untrusted-repo.git

# Or type the full command:
git safe-clone https://github.com/user/untrusted-repo.git

# Useful Options:
git sc https://github.com/user/untrusted-repo.git my-folder
git sc https://github.com/user/untrusted-repo.git --dry-run
```

---

## 🔍 How It Works

### During `git safe-pull`:
```
1. git fetch            (Updates git refs safely in memory; workspace untouched)
       │
2. Security Scanner     (Inspects incoming commits, new files, and diff lines)
       │
3. Evaluation:
   ├── Clean?           ───► Fast-forward merge automatically!
   └── Suspicious /     ───► 🚨 Display warning alert table
       New Files?            [v] View incoming diff
                             [y] Approve and merge
                             [n] Abort (leaves workspace completely untouched)
```

### During `git safe-clone`:
```
1. git clone --no-checkout  (Metadata only; ZERO files on disk)
       │
2. Security Scanner         (Inspects all files and configs in memory)
       │
3. Evaluation:
   ├── Clean?               ───► Checks out files cleanly to disk!
   └── Suspicious /         ───► 🚨 Display warning alert table
       Malware Detected?         [a] Abort and delete repo (safe!)
                                 [c] Checkout anyway
                                 [l] List repository files
```

---

## 🛡️ Built-in Security Rules

| Threat Pattern | Detection Logic | Action |
| :--- | :--- | :--- |
| **New Files Added** | Detects any newly added file (`A`) in incoming commits. | Prompts for manual approval before files hit disk. |
| **VS Code Auto-Tasks** | Detects `"runOn": "folderOpen"` or `.vscode/tasks.json`. | 🚨 **CRITICAL** Alert |
| **Off-Screen Injections** | Detects added lines > 250 characters padded with > 25 spaces. | 🚨 **CRITICAL** Alert |
| **Package.json Injections** | Detects scripts executing `node init`, `.orc`, `curl`, `powershell`. | 🚨 **CRITICAL** Alert |
| **Suspicious Extensions** | Detects `.orc`, `.bat`, `.cmd`, `.vbs`, `.ps1`, `.exe`, `.bin`. | ⚠️ **HIGH** Alert |
| **`.gitignore` Tampering** | Detects deletion of `.env` or `*.env` from `.gitignore`. | ⚠️ **HIGH** Alert |
| **Obfuscated Payloads** | Detects `splitLane`, `TextDecoder`, `eval(`, `Function()`. | ⚠️ **HIGH** Alert |

---

## 🧪 Testing

Run the built-in test suite:
```bash
node --test test/scanner.test.js
```

---

## 📄 License
MIT © [Md. Rezaul Karim](https://github.com/devRezaulKarim)
