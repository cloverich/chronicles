const { app, BrowserWindow } = require('electron')
const path = require('path');
const { spawn, fork } = require('child_process');

// todo: probably should start UI ASAP, put it in loading state while this spawns, etc
if (app.isPackaged) {
  // This is tsc + build directory set in the build script.
  // Yeah, stupid and confusing. Prototype life for me.
  const compiledTsServerLocation = path.join(__dirname, '/api/index');

  fork(compiledTsServerLocation, [path.join(app.getPath('userData'), 'pragma.db')], { stdio: 'inherit'});

} else {
  // https://www.matthewslipper.com/2019/09/22/everything-you-wanted-electron-child-process.html
  spawn('npx', ['ts-node',  __dirname + '/../api/index', __dirname + '/../../pragma.db'], {
    cwd: app.getAppPath(),
    stdio: 'inherit',
  });
}

function createWindow () {
  // Create the browser window.
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      // preload: path.join(app.getAppPath(), 'preload.js')
    }
  })

  // and load the index.html of the app.
  if (app.isPackaged) {
    win.loadFile('index.html')
  } else {
    // assumes webpack-dev-server is hosting at this url
    win.loadURL('http://localhost:9000')
  }

  // Open the DevTools.
  // win.webContents.openDevTools()
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(createWindow)

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.