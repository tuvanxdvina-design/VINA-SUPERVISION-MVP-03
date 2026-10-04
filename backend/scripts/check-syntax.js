const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const git = process.env.GIT || (process.platform === 'win32' && fs.existsSync('C:\\Program Files\\Git\\cmd\\git.exe')
  ? 'C:\\Program Files\\Git\\cmd\\git.exe'
  : 'git');

function trackedJsFiles() {
  const out = execFileSync(git, ['ls-files', '*.js'], { cwd: root, encoding: 'utf8' });
  return out.split(/\r?\n/).filter(Boolean);
}

let failed = 0;
for (const file of trackedJsFiles()) {
  try {
    execFileSync(process.execPath, ['--check', file], { cwd: root, stdio: 'pipe' });
  } catch (error) {
    failed++;
    const stderr = error.stderr ? error.stderr.toString() : error.message;
    console.error(`Syntax error in ${file}\n${stderr}`);
  }
}

if (failed) {
  console.error(`${failed} JavaScript file(s) failed syntax checks.`);
  process.exit(1);
}

console.log('JavaScript syntax OK.');
