import { app } from 'electron';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

// Minimal Electron test runner that provides Electron APIs to tests
app.whenReady().then(() => {
  console.log('Running tests in Electron context...');
  
  // Run Node.js test runner inside Electron process
  // This gives tests access to electron APIs while using existing test infrastructure
  const testProcess = spawn('node', [
    '--test', 
    'src/**/*.test.bundle.mjs'
  ], {
    stdio: 'inherit',
    cwd: projectRoot
  });
  
  testProcess.on('close', (code) => {
    console.log(`Tests completed with exit code: ${code}`);
    app.exit(code);
  });
  
  testProcess.on('error', (error) => {
    console.error('Test process error:', error);
    app.exit(1);
  });
});

// Prevent Electron from quitting when all windows are closed (we have no windows)
app.on('window-all-closed', () => {
  // Do nothing - let the test process control exit
});

// Handle app activation (macOS)
app.on('activate', () => {
  // Do nothing
});