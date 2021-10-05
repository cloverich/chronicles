const { app, BrowserWindow, ipcMain, shell, dialog, protocol } = require("electron");
const { spawn, fork, execSync } = require("child_process");
const path = require("path");
const fs = require('fs');
const settings = require('electron-settings');
const { initUserFilesDir } =  require('./userFilesInit');

// when packaged, it should be in Library/Application Support/Chronicles/settings.json
// when in dev, Library/Application Support/Chronicles/settings.json
console.log('settings.file: ', settings.file());


initUserFilesDir(app.getPath("userData"));
console.log('settings', settings.getSync());

const USER_FILES_DIR = settings.getSync('USER_FILES_DIR');
if (!USER_FILES_DIR) {
  throw new Error('USER_FILES_DIR missing in main tooo after calling initUserFilesDir');
}

const DATABASE_URL = 'DATABASE_URL';

// Used by createWindow, but needed in database routine because of the filepicker call
let mainWindow;

// when not available, dbfile is undefined
let dbfile = settings.getSync(DATABASE_URL);

/**
 * Persist the database url to settings file
 * assumes url is a full, valid filepath
 * 
 * todo: Add validation here
 */
function setDatabaseUrl(url) {
  if (!url) throw new Error('setDatabaseUrl called with null or empty string');

  // todo: validate it can be loaded (or created) by Prisma client
  settings.setSync(DATABASE_URL, url);
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

// Allow files to load if using the "chronicles" protocol
// https://www.electronjs.org/docs/api/protocol
app.whenReady().then(() => {
  protocol.registerFileProtocol('chronicles', (request, callback) => {
    // strip the leading chronicles://
    const url = decodeURI(request.url.substr(13));

    // add the USER_FILES directory
    // todo: cache this value. The backend API updates it after start-up, otherwise all updates
    // happen through main. Refactor so backend api calls through here, or move default user files setup
    // logic into main, then cache the value
    const absoluteUrl = path.join(settings.getSync('USER_FILES_DIR'), url);

    // NOTE: If the file does not exist... ELECTRON WILL MAKE AN HTTP REQUEST WITH THE FULL URL???
    // Seems like... odd fallback behavior.
    // This isn't performant but is for my sanity. 
    // todo: Upgrade libraries, see if this behavior is fixed or can be disabled somehow?
    if (!fs.existsSync(absoluteUrl)) {
      console.warn('chronicles:// file handler could not find file:', absoluteUrl, 'Maybe you need to set the USER_FILES or update broken file links?')
    }

    // todo: santize URL: Prevent ../, ensure it points to USER_FILES directory
    // https://github.com/cloverich/chronicles/issues/53
    callback({ path: absoluteUrl })
  })
})


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


// Run migrations. NOTE: This isn't smart and doesn't work in production,
// you just have to point production at a db you setup in dev, for now...
if (app.isPackaged) {
  // We don't have node in production, and prisma migrate requires CLI usage
  // So long as prisma is listed as as production dependency... should be able to
  // rely on the script although it likely has platform native dependencies
  // https://github.com/prisma/prisma/issues/4703

  // Even this won't work with dev dependencies installed... either .bin gets stripped 
  // or it can't resolve it. For now 
  // execSync(`DATABASE_URL="file:${dbfile}" ./node_modules/.bin/prisma migrate deploy`, )
} else {
  // Don't forget to create migration after making changes
  // `prisma migrate dev --name added_job_title`
  // https://www.prisma.io/docs/guides/database/prototyping-schema-db-push
  execSync(`DATABASE_URL="file:${dbfile}" npx prisma db push`, { cwd: path.join(__dirname, '/../../')});
}

// Start the backend server. 
// todo: This API server is a legacy from before I was using Electron and is
// how file persistence and database operations happen. Better to abandon it
// and move the logic to a preload script
// https://www.matthewslipper.com/2019/09/22/everything-you-wanted-electron-child-process.html
if (app.isPackaged) {
  console.log('packaged app setting USER_FILES_DIR to ....', USER_FILES_DIR);
  const serverProcess = fork(
    // This is tsc + build directory set in the build script.
    // Yeah, stupid and confusing. Prototype life for me.
    path.join(__dirname, "/api/index"),

    // todo: Since moving to pragma this is unused by current code paths
    [path.join(app.getPath("userData"), "pragma.db")],

    { stdio: [0, 1, 2, "ipc"],

    // NOTE: DATABASE_URL passed as environment variable because that is how Prisma picks it up
    // see schema.prisma
    env: { 
      ...process.env,
    
      // https://www.prisma.io/docs/reference/database-reference/connection-urls
      // Sqlite file must start with `file:`
      DATABASE_URL: `file:${dbfile}`,
      USER_DATA_DIR: app.getPath('userData'),
      USER_FILES_DIR: USER_FILES_DIR, 
    }
  });

  setupBackendListener(serverProcess);
} else {
  const serverProcess = spawn(
    "npx",

    // todo: Since moving to pragma this is unused by current code paths
    ["ts-node", __dirname + "/../api/index", __dirname + "/../../pragma.db"],
    {
      cwd: app.getAppPath(),
      stdio: [0, 1, 2, "ipc"],

      // NOTE: DATABASE_URL passed as environment variable because that is how Prisma picks it up
      // see schema.prisma
      env: { 
        ...process.env,

        // https://www.prisma.io/docs/reference/database-reference/connection-urls
        // Sqlite file must start with `file:`
        DATABASE_URL: `file:${dbfile}`,

        // todo: these are now redundant...
        USER_DATA_DIR: app.getPath('userData'),
        USER_FILES_DIR: USER_FILES_DIR, 
      }
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
      // todo: What was I thinking here? This doesn't even make sense... 
      // its just creating a new database
      setDatabaseUrl(path.join(filepath, 'chronicles.db'))
    } else {
      // use user provided database
      // todo: validation :grimace
      setDatabaseUrl(filepath)
    }
  } catch (err) {
    console.error(`Error checking for file ${filepath} -- maybe it doesn't exist?`)
    console.error(err);
  }

  event.reply('preferences-updated');
})

// Preferences in UI allows user to specify user files directory
ipcMain.on('select-user-files-dir', async (event, arg) => {
  if (!mainWindow) {
    console.error('received request to open file picker but mainWindow is undefined');
    return;
  }

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory']
  });

  const filepath = result.filePaths[0];

  // user selected cancel
  if (!filepath) return;

  // todo: feedback to user if error
  // https://github.com/cloverich/chronicles/issues/52
  try {
    if (fs.lstatSync(filepath).isDirectory()) {
      // move existing database file to new location
      settings.setSync('USER_FILES_DIR', filepath)
    } else {
      throw new Error('User files must be valid directory');
    }
  } catch (err) {
    console.error(`Error checking for file ${filepath} -- maybe it doesn't exist?`)
    console.error(err);
  }

  event.reply('preferences-updated');
})