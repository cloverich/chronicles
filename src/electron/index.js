const { app, BrowserWindow, ipcMain, shell, dialog, protocol } = require("electron");
const path = require("path");
const fs = require('fs');
const { initUserFilesDir } =  require('./userFilesInit');
const settings = require('./settings');

// when packaged, it should be in Library/Application Support/Chronicles/settings.json
// when in dev, Library/Application Support/Chronicles/settings.json


initUserFilesDir(app.getPath("userData"));
console.log('application settings at startup:', settings.store);

const USER_FILES_DIR = settings.get('USER_FILES_DIR');
if (!USER_FILES_DIR) {
  throw new Error('USER_FILES_DIR missing in main tooo after calling initUserFilesDir');
}

const DATABASE_URL = 'DATABASE_URL';

// Used by createWindow, but needed in database routine because of the filepicker call
let mainWindow;

// when not available, dbfile is undefined
let dbfile = settings.get(DATABASE_URL);

/**
 * Persist the database url to settings file
 * assumes url is a full, valid filepath
 * 
 * todo: Add validation here
 */
function setDatabaseUrl(url) {
  if (!url) throw new Error('setDatabaseUrl called with null or empty string');

  // todo: validate it can be loaded (or created) by Prisma client
  settings.set(DATABASE_URL, url);
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
    const absoluteUrl = path.join(settings.get('USER_FILES_DIR'), url);

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
      sandbox: false,
      contextIsolation: false,
      // same as above
      enableRemoteModule: false,
    },
    
  });

  // and load the index.html of the app.
  if (app.isPackaged) {
    mainWindow.loadFile("index.html");
  } else {
    // assumes webpack-dev-server is hosting at this url
    mainWindow.loadURL("http://localhost:9000");
    mainWindow.webContents.openDevTools();
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
      settings.set('USER_FILES_DIR', filepath)
    } else {
      throw new Error('User files must be valid directory');
    }
  } catch (err) {
    console.error(`Error checking for file ${filepath} -- maybe it doesn't exist?`)
    console.error(err);
  }

  event.reply('preferences-updated');
})

ipcMain.on('inspect-element', async (event, arg) => {
  if (!mainWindow) {
    console.error('received request to open file picker but mainWindow is undefined');
    return;
  }

  mainWindow.webContents.inspectElement(arg.x, arg.y)
})