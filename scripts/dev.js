const esbuild = require('esbuild');
const cp = require('child_process');
const electron = require('electron')
const lodash = require('lodash')

// After successful rebuild, log results
function afterRebuild(name, cb) {
  return (error, result) => {
    if (error) {
      console.error(`${name} bundle completed with error`, error);
    } else {
      console.log(`${name} bundle completed`);
      restartElectron()
    }
  }
}

// After successful build, log results
function afterBuild(name) {
  return ({errors, warnings, ...rest}) => {
    if (errors.length) {
      console.error(`${name} bundle completed with errors`, errors);
    } else if (warnings.length) {
      console.warn(`${name} bundle completed with warnings`, warnings);
    } else {
      console.log(`${name} bundle completed`);
    }

    // note: until I see errors or warnings, unsure if I should have any special behavior...
    startElectron()
  }
}

// build renderer bundle
esbuild.build({
  entryPoints: ['src/index.tsx'],
  outfile: 'src/renderer.bundle.js',
  bundle: true,
  platform: 'browser',
  watch: {
    onRebuild: afterRebuild('renderer')
  },
}).then(afterBuild('renderer'), console.error);

// build preload bundle
esbuild.build({
  entryPoints: ['src/preload/index.ts'],
  outfile: 'src/preload.bundle.js',
  bundle: true,
  platform: 'node',
  external: ['electron', 'electron-store', 'better-sqlite3'],
  watch: {
    onRebuild: afterRebuild('preload')
  },
}).then(afterBuild('preload'), console.error);

// build electron main bundle
esbuild.build({
  entryPoints: ['src/electron/index.js'],
  outfile: 'src/main.bundle.js',
  bundle: true,
  platform: 'node',
  external: ['electron', 'electron-store', 'better-sqlite3'],
  watch: {
    onRebuild: afterRebuild('main')
  },
}).then(afterBuild('main'), console.error);

// For holding the spawned Electron main process, so it can
// be .kill()'ed on re-start
let eprocess;

// Track build completions, see below
let startCounter = 0;

// Start the electron main process
function startElectron() {
  // Naive way to wait for all three bundles before starting the first time, since
  // main bundle completes quickest
  startCounter++
  if (startCounter < 3) return;
  
  console.log('starting electron')
  eprocess = cp.spawn(`${electron}`, ['src/main.bundle.js'], { stdio: 'inherit'});

  eprocess.on('error', (error) => {
    console.error('electron error', error, error.message)
    process.exit(1)
  })
}

// Re-start the main process
const restartElectron = lodash.debounce(function startElectron() {
  if (eprocess) eprocess.kill('SIGTERM');

  console.log('starting electron')
  eprocess = cp.spawn(`${electron}`, ['src/main.bundle.js'], { stdio: 'inherit'});

  eprocess.on('error', (error) => {
    console.error('electron error', error, error.message)
    process.exit(1)
  })
}, 200)