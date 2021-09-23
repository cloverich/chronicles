const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const { spawn, fork } = require("child_process");
const path = require("path");
const fs = require('fs');
const settings = require('electron-settings');

// when packaged, it should be in Library/Application Support/Chronicles/settings.json
// when in dev, Library/Application Support/Chronicles/settings.json
console.log('settings.file: ', settings.file());

const DATABASE_URL = 'DATABASE_URL';

// Used by createWindow, but needed in database routine because of the filepicker call
let mainWindow;

// when not available, dbfile is undefined
let dbfile = settings.getSync(DATABASE_URL);

/**
 * Persist the database url to settings file
 * assumes url is a full, valid filepath
 */
function setDatabaseUrl(url) {
  if (!url) throw new Error('setDatabaseUrl called with null or empty string');

  // https://www.prisma.io/docs/reference/database-reference/connection-urls
  // Sqlite file must start with `file:`
  const fileUrl = url.startsWith('file:') ? url : `file:`

  // todo: validate it can be loaded (or created) by Prisma client
  settings.setSync(DATABASE_URL, fileUrl);
}

// Provide and set a default DB if one is not found.
if (!dbfile) {
  try {
    dbfile = path.join(app.getPath("userData"), "chronicles.db");
    setDatabaseUrl(dbfile);
  } catch (err) {
    // note: this is defensive (untested)
    console.error('Error saving DATABASE_URL to settings file after using a default location');
    console.error('This will result in the user being unable to change the location of the file without an obvious reason why')
    console.error(err);
  }
}

/**
 * Open browser windows on link-click, an event triggered by renderer process.
 * @param {String} link
 */
ipcMain.on('link-click', (_, link) => {
  // This presents a security challenge: see https://github.com/cloverich/chronicles/issues/51
  shell.openExternal(link);
});


/**
 * After the backend is spawned, await the dynamically
 * assigned port and relay that information to the UI,
 * so it can construct an http client to communicate
 * with it.
 *
 * @param {ChildProcess} serverProcess
 */
// @ts-ignore
function setupBackendListener(serverProcess) {
  // @ts-ignore
  let serverPort;

  // @ts-ignore
  serverProcess.once("message", (msg) => {
    const hopefullyJson = JSON.parse(msg);
    // todo: validate message
    if (hopefullyJson.name === "server_port") {
      serverPort = hopefullyJson.port;
    }
  });

  /**
   * When the UI is up, it will ask this script for the backend
   * port so it can instantiate the client.
   */
  ipcMain.handle("server:gimme", async (event, someArgument) => {
    // @ts-ignore
    while (!serverPort) {
      await new Promise((r) => setTimeout(r, 100));
    }

    // @ts-ignore
    return serverPort;
  });

  app.on("quit", () => {
    if (serverProcess) {
      serverProcess.kill();
    }
  });
}

// Start the backend server.
// https://www.matthewslipper.com/2019/09/22/everything-you-wanted-electron-child-process.html
if (app.isPackaged) {
  const serverProcess = fork(
    // This is tsc + build directory set in the build script.
    // Yeah, stupid and confusing. Prototype life for me.
    path.join(__dirname, "/api/index"),

    // todo: Since moving to pragma this is unused by current code paths
    [path.join(app.getPath("userData"), "pragma.db")],
    { stdio: [0, 1, 2, "ipc"], env: { ...process.env, DATABASE_URL: dbfile} }
  );

  setupBackendListener(serverProcess);
} else {
  const serverProcess = spawn(
    "npx",

    // todo: Since moving to pragma this is unused by current code paths
    ["ts-node", __dirname + "/../api/index", __dirname + "/../../pragma.db"],
    {
      cwd: app.getAppPath(),
      stdio: [0, 1, 2, "ipc"],
      env: { ...process.env, DATABASE_URL: dbfile}
    }
  );

  setupBackendListener(serverProcess);
}


function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      // This is needed to load electron modules
      // Loading the electron requiring scripts in a preload
      // script, then disabling nodeIntegration, would be
      // more secure
      // NOTE: Right now, loading local images also requires this. 
      // Loading images via the API would resolve this issue.
      // ...or using a custom protocol
      // https://github.com/electron/electron/issues/23393
      nodeIntegration: true,
      // same as above
      enableRemoteModule: true,
    },
  });

  // and load the index.html of the app.
  if (app.isPackaged) {
    mainWindow.loadFile("index.html");
  } else {
    // assumes webpack-dev-server is hosting at this url
    mainWindow.loadURL("http://localhost:9000");
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.


// Preferences in UI allows user to specify database file
// This section catches the button click and provides the file picking
// and persisting logic
// todo: This would be better suited to a preload script
ipcMain.on('select-database-file', async (event, arg) => {
  if (!mainWindow) {
    console.error('received request to open file picker but mainWindow is undefined');
    return;
  }

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory', 'openFile']
  });

  const filepath = result.filePaths[0];

  // user selected cancel
  if (!filepath) return;

  // todo: feedback to user if error
  // https://github.com/cloverich/chronicles/issues/52
  try {
    if (fs.lstatSync(filepath).isDirectory()) {
      // move existing database file to new location
      setDatabaseUrl(path.join(filepath, 'chronicles.db'))
    } else {
      // use user provided database
      // todo: validation :grimace
      setDatabaseUrl(path.join(filepath, filepath))
    }
  } catch (err) {
    console.error(`Error checking for file ${filepath} -- maybe it doesn't exist?`)
    console.error(err);
  }
})
