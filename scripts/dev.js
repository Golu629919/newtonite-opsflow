import { spawn } from 'node:child_process';
import process from 'node:process';

console.log('\n=======================================================');
console.log('🚀 Starting Newtonite OpsFlow Full-Stack Dev Environment');
console.log('   Backend API & SSE: http://localhost:3001');
console.log('   Vite Frontend:     http://localhost:5173');
console.log('=======================================================\n');

const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';
const npxCmd = isWin ? 'npx.cmd' : 'npx';

// 1. Start Server
const server = spawn('node', ['server/index.js'], {
  stdio: 'inherit',
  shell: isWin,
  env: { ...process.env, PORT: '3001' }
});

// 2. Start Vite Dev Server
const client = spawn(npxCmd, ['vite'], {
  stdio: 'inherit',
  shell: isWin
});

function cleanup() {
  console.log('\nShutting down dev servers...');
  server.kill();
  client.kill();
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
