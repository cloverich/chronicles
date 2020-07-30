const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const { spawn, fork } = require("child_process");

/**
 * Open browser windows on link-click, an event triggered by renderer process.
 * @param {String} link
 */
ipcMain.on('link-click', (_, link) => {
  // This presents a security challenge: see https://github.com/cloverich/chronicles/issues/390
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
    [path.join(app.getPath("userData"), "pragma.db")],
    { stdio: [0, 1, 2, "ipc"] }
  );

  setupBackendListener(serverProcess);
} else {
  const serverProcess = spawn(
    "npx",
    ["ts-node", __dirname + "/../api/index", __dirname + "/../../pragma.db"],
    {
      cwd: app.getAppPath(),
      stdio: [0, 1, 2, "ipc"],
    }
  );

  setupBackendListener(serverProcess);
}

function createWindow() {
  // Create the browser window.
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      // This is needed to load electron modules
      // Loading the electron requiring scripts in a preload
      // script, then disabling nodeIntegration, would be
      // more secure
      nodeIntegration: true,
      // same as above
      enableRemoteModule: true,
    },
  });

  // and load the index.html of the app.
  if (app.isPackaged) {
    win.loadFile("index.html");
  } else {
    // assumes webpack-dev-server is hosting at this url
    win.loadURL("http://localhost:9000");
  }

  // Open the DevTools.
  // win.webContents.openDevTools()
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
