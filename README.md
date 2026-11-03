# 🛡️ git-safe-pull

> **A safe, pre-merge security guardrail for `git pull` that catches malware, unauthorized new files, and hidden script injections BEFORE they touch your disk.**

[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-success.svg)](package.json)

---

## 🚨 Why git-safe-pull?

Standard `git pull` fetches and merges files directly into your workspace. In modern developer-targeted supply chain attacks (such as **Lazarus / Contagious Interview** campaigns):

1. **Malicious `.vscode/tasks.json`** files are configured with `"runOn": "folderOpen"`. The millisecond `git pull` writes files to disk, your open VS Code editor automatically executes the malware silently in the background.
2. **Hidden Executables**: Attackers disguise scripts inside fonts (e.g. `fa-brand-400.orc`) or root scripts (like `init`).
3. **Off-Screen Padding**: Payloads are appended to files like `eslint.config.js` with hundreds of spaces pushing malicious code off-screen.
4. **Script Tampering**: `package.json` scripts (`"build"`, `"dev"`) are modified to execute hidden scripts.
5. **`.gitignore` Sabotage**: `.env` is removed so secrets are accidentally committed.

`git-safe-pull` solves this by **fetching first into memory without writing to your disk**, analyzing the incoming diff against security rules, and requiring explicit manual confirmation if any new files or suspicious patterns are detected.

---

## 📦 Installation

### Global Installation via NPM:
```bash
npm install -g git-safe-pull
```

*(Or run directly on demand without installing:)*
```bash
npx git-safe-pull
```

### Install Directly from GitHub:
```bash
npm install -g git+https://github.com/devRezaulKarim/git-safe-pull.git
```

---

## 🚀 Usage

Once installed globally, you can run it inside any Git repository using:

```bash
git-safe-pull
```

### Setup as a Native Git Command / Alias:
Git automatically recognizes `git-safe-pull` in your PATH! You can also set a convenient short alias:

```bash
git config --global alias.safe-pull "!git-safe-pull"
git config --global alias.sp "!git-safe-pull"
```

Now you can simply run:
```bash
git safe-pull
# or
git sp
```

---

## 🔍 How It Works

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

## ⚙️ CLI Options

| Flag | Description |
| :--- | :--- |
| `--diff` | Display the full interactive incoming diff before prompting. |
| `--dry-run` | Fetch and run the security scan without merging. |
| `-y, --force` | Bypass confirmation prompts and merge automatically. |
| `--strict` | Require manual approval for **all** pulls, even if clean. |
| `-h, --help` | Display help and usage information. |
| `-v, --version` | Display version number. |

---

## 🧪 Testing

Run the built-in test suite:
```bash
node --test test/scanner.test.js
```

---

## 📄 License
MIT © [Md. Rezaul Karim](https://github.com/devRezaulKarim)
