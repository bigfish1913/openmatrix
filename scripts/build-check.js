// Safe build script that checks if dependencies are available
const { existsSync } = require('fs');
const { execSync } = require('child_process');

// Check if we're in a git clone scenario (npm install from github)
// In this case, node_modules might not be fully populated yet
const tscPath = require.resolve('typescript').replace('lib/typescript.js', 'bin/tsc');

if (!existsSync(tscPath)) {
  console.log('Skipping build: TypeScript not available yet');
  process.exit(0);
}

try {
  execSync(`node "${tscPath}"`, { stdio: 'inherit' });
} catch (e) {
  console.log('Build failed, but continuing installation');
  process.exit(0);
}
