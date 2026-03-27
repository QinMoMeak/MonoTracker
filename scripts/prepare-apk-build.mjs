import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const docDir = path.join(rootDir, 'doc');
const stateFile = path.join(docDir, '.build-state.json');
const packageJsonPath = path.join(rootDir, 'package.json');
const buildGradlePath = path.join(rootDir, 'android', 'app', 'build.gradle');
const worklogPath = path.join(docDir, 'WORKLOG.md');

const ignoredDirs = new Set([
  '.git',
  '.idea',
  '.jdk',
  '.vscode',
  '.npm-cache',
  '.tools',
  'node_modules',
  'dist',
  'generated',
  'android/.gradle',
  'android/.idea',
  'android/build',
  'android/app/build',
  'android/capacitor-cordova-android-plugins/build'
]);

const ignoredFiles = new Set([
  'doc/WORKLOG.md',
  'doc/.build-state.json',
  'android/local.properties',
  'android/app/src/main/assets/capacitor.config.json',
  'android/app/src/main/assets/capacitor.plugins.json'
]);

const ignoredDocPattern = /^doc\/BUILD_DIFF_[^/]+\.md$/;
const ignoredPathPrefixes = ['android/app/src/main/assets/public/'];

const readText = filePath => fs.readFileSync(filePath, 'utf8');
const writeUtf8 = (filePath, content) => fs.writeFileSync(filePath, content, 'utf8');

const getPackageJson = () => JSON.parse(readText(packageJsonPath));

const parseGradleVersion = content => {
  const versionNameMatch = content.match(/versionName\s+"([^"]+)"/);
  const versionCodeMatch = content.match(/versionCode\s+(\d+)/);
  if (!versionNameMatch || !versionCodeMatch) {
    throw new Error('Failed to parse versionName/versionCode from android/app/build.gradle');
  }
  return {
    versionName: versionNameMatch[1],
    versionCode: Number(versionCodeMatch[1])
  };
};

const bumpPatch = version => {
  const parts = version.split('.').map(part => Number(part));
  if (parts.length !== 3 || parts.some(part => !Number.isInteger(part) || part < 0)) {
    throw new Error(`Unsupported version format: ${version}`);
  }
  parts[2] += 1;
  return parts.join('.');
};

const normalizeRelPath = relPath => relPath.replace(/\\/g, '/');

const shouldIgnore = relPath => {
  const normalized = normalizeRelPath(relPath);
  if (ignoredFiles.has(normalized)) return true;
  if (ignoredDocPattern.test(normalized)) return true;
  if (ignoredPathPrefixes.some(prefix => normalized.startsWith(prefix))) return true;
  return Array.from(ignoredDirs).some(dir => normalized === dir || normalized.startsWith(`${dir}/`));
};

const normalizeContentForSnapshot = (relPath, buffer) => {
  const normalized = normalizeRelPath(relPath);
  if (normalized === 'package.json') {
    const pkg = JSON.parse(buffer.toString('utf8'));
    pkg.version = '__AUTO_VERSION__';
    return Buffer.from(JSON.stringify(pkg, null, 2) + '\n', 'utf8');
  }

  if (normalized === 'android/app/build.gradle') {
    const text = buffer
      .toString('utf8')
      .replace(/versionCode\s+\d+/, 'versionCode __AUTO_VERSION_CODE__')
      .replace(/versionName\s+"[^"]+"/, 'versionName "__AUTO_VERSION_NAME__"');
    return Buffer.from(text, 'utf8');
  }

  return buffer;
};

const hashBuffer = buffer => crypto.createHash('sha256').update(buffer).digest('hex');

const collectSnapshot = dir => {
  const snapshot = {};
  const visit = currentDir => {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);
      const relPath = normalizeRelPath(path.relative(rootDir, absolutePath));
      if (!relPath || shouldIgnore(relPath)) {
        continue;
      }
      if (entry.isDirectory()) {
        visit(absolutePath);
        continue;
      }
      const buffer = fs.readFileSync(absolutePath);
      snapshot[relPath] = hashBuffer(normalizeContentForSnapshot(relPath, buffer));
    }
  };
  visit(dir);
  return snapshot;
};

const loadPreviousState = () => {
  if (!fs.existsSync(stateFile)) return null;
  return JSON.parse(readText(stateFile));
};

const buildDiff = (previousSnapshot, currentSnapshot) => {
  const previousPaths = new Set(Object.keys(previousSnapshot || {}));
  const currentPaths = new Set(Object.keys(currentSnapshot));
  const added = [];
  const modified = [];
  const deleted = [];

  for (const relPath of currentPaths) {
    if (!previousPaths.has(relPath)) {
      added.push(relPath);
      continue;
    }
    if (previousSnapshot[relPath] !== currentSnapshot[relPath]) {
      modified.push(relPath);
    }
  }

  for (const relPath of previousPaths) {
    if (!currentPaths.has(relPath)) {
      deleted.push(relPath);
    }
  }

  added.sort();
  modified.sort();
  deleted.sort();
  return { added, modified, deleted };
};

const formatFileList = items => {
  if (items.length === 0) return '- (none)';
  return items.map(item => `- ${item}`).join('\n');
};

const appendWorklogEntry = ({ previousVersion, nextVersion, previousCode, nextCode, diffDocName, diff }) => {
  const lines = [
    '',
    `- ${new Date().toISOString().slice(0, 10)}`,
    `  - APK build version: ${previousVersion} / ${previousCode} -> ${nextVersion} / ${nextCode}`,
    `  - Diff doc: doc/${diffDocName}`,
    '  - Changes?',
    ...diff.added.map(item => `    - [ADD] ${item}`),
    ...diff.modified.map(item => `    - [MOD] ${item}`),
    ...diff.deleted.map(item => `    - [DEL] ${item}`),
    `  - APK output: android/app/build/outputs/apk/debug/app-debug.apk`
  ];

  const normalizedLines = lines.filter((line, index, arr) => !(index > 0 && line === '  - Changes?' && arr[index - 1] === '  - Changes?'));
  const content = fs.existsSync(worklogPath) ? readText(worklogPath).replace(/\s*$/, '') : '# WORKLOG\n';
  writeUtf8(worklogPath, `${content}\n${normalizedLines.join('\n')}\n`);
};

const main = () => {
  fs.mkdirSync(docDir, { recursive: true });

  const previousState = loadPreviousState();
  const packageJson = getPackageJson();
  const gradleContent = readText(buildGradlePath);
  const gradleVersion = parseGradleVersion(gradleContent);

  if (packageJson.version !== gradleVersion.versionName) {
    throw new Error(`Version mismatch: package.json=${packageJson.version}, build.gradle=${gradleVersion.versionName}`);
  }

  const previousVersion = packageJson.version;
  const previousCode = gradleVersion.versionCode;
  const nextVersion = bumpPatch(previousVersion);
  const nextCode = previousCode + 1;

  const currentSnapshot = collectSnapshot(rootDir);
  const diff = buildDiff(previousState?.snapshot || null, currentSnapshot);

  packageJson.version = nextVersion;
  writeUtf8(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);

  const nextGradleContent = gradleContent
    .replace(/versionCode\s+\d+/, `versionCode ${nextCode}`)
    .replace(/versionName\s+"[^"]+"/, `versionName "${nextVersion}"`);
  writeUtf8(buildGradlePath, nextGradleContent);

  const timestamp = new Date().toISOString();
  const diffDocName = `BUILD_DIFF_${nextVersion}.md`;
  const diffDocPath = path.join(docDir, diffDocName);
  const diffDoc = [
    `# Build Diff ${nextVersion}`,
    '',
    `- Built at: ${timestamp}`,
    `- Previous build: ${previousVersion} (${previousCode})`,
    `- Current build: ${nextVersion} (${nextCode})`,
    '- Scope: source/config diffs since previous APK build',
    '- Excludes: auto-generated build outputs, BUILD_DIFF docs, WORKLOG auto-entry, version fields',
    '',
    '## Summary',
    `- Added: ${diff.added.length}`,
    `- Modified: ${diff.modified.length}`,
    `- Deleted: ${diff.deleted.length}`,
    '',
    '## Added',
    formatFileList(diff.added),
    '',
    '## Modified',
    formatFileList(diff.modified),
    '',
    '## Deleted',
    formatFileList(diff.deleted),
    ''
  ].join('\n');
  writeUtf8(diffDocPath, diffDoc);

  appendWorklogEntry({ previousVersion, nextVersion, previousCode, nextCode, diffDocName, diff });

  const nextState = {
    builtAt: timestamp,
    version: nextVersion,
    versionCode: nextCode,
    snapshot: currentSnapshot
  };
  writeUtf8(stateFile, `${JSON.stringify(nextState, null, 2)}\n`);

  console.log(`Prepared APK build: ${previousVersion} (${previousCode}) -> ${nextVersion} (${nextCode})`);
  console.log(`Diff doc: ${path.relative(rootDir, diffDocPath)}`);
};

main();
