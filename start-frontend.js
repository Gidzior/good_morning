const { execSync } = require('child_process');
const path = require('path');
process.chdir(path.join(__dirname, 'frontend'));
require('child_process').spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', '--port', '5173'],
  { stdio: 'inherit', cwd: path.join(__dirname, 'frontend') }
);
