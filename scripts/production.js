const esbuild = require('esbuild');
const cp = require('child_process');
const electron = require('electron');

// After successful build, log results
function afterBuild(name) {
  return ({ errors, warnings, ...rest }) => {
    console.log(rest);
    if (errors.length) {
      console.error(`${name} bundle completed with errors`, errors);
      process.exit(1)
    } else if (warnings.length) {
      console.warn(`${name} bundle completed with warnings`, warnings);
    } else {
      console.log(`${name} bundle completed`);
    }
  }
}

// build renderer bundle
esbuild.build({
  entryPoints: ['src/index.tsx'],
  outfile: 'src/renderer.bundle.js',
  bundle: true,
  platform: 'browser',
}).then(afterBuild('renderer'), console.error);

// build preload bundle
esbuild.build({
  entryPoints: ['src/preload/index.ts'],
  outfile: 'src/preload.bundle.js',
  bundle: true,
  platform: 'node',
  external: ['knex', 'electron', 'electron-store', 'better-sqlite3'],
}).then(afterBuild('preload'), console.error);

// build electron main bundle
esbuild.build({
  entryPoints: ['src/electron/index.js'],
  outfile: 'src/main.bundle.js',
  bundle: true,
  platform: 'node',
  external: ['electron', 'electron-store', 'better-sqlite3'],
}).then(afterBuild('main'), console.error);
