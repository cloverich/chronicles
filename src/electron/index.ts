import { BrowserWindow, app, dialog, ipcMain, protocol, shell } from "electron";
import contextMenu from "electron-context-menu";
import fs from "fs";
import path from "path";
import url, { fileURLToPath } from "url";
import { ensureDir } from "./ensureDir.js";
import { initAppEnvironment } from "./initAppEnvironment.js";
import settings from "./settings.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Consolidated user files and database setup
const { databaseUrl: dbUrl, notesDir } = initAppEnvironment(
  settings,
  app.getPath("userData"),
);
console.log("application settings at startup:", settings.store);

// Used by createWindow, but needed in database routine because of the filepicker call
let mainWindow: BrowserWindow | null = null;

// Allow files in <img> and <video> tags to load using the "chronicles://" protocol
// https://www.electronjs.org/docs/api/protocol
app.whenReady().then(() => {
  // todo: registerFileProtocol is deprecated; using the new protocol method works,
  // but videos don't seek properly.
  protocol.registerFileProtocol("chronicles", (request, callback) => {
    const path = validateChroniclesUrl(request.url);
    if (path) {
      callback({ path });
    } else {
      callback({ path: undefined });
    }
  });
});

/**
 * Convert a "chronicles://" URL to an absolute file path.
 *
 * This function is used by the "chronicles://" protocol handler to resolve file paths
 * to the user files directory. It also performs some basic security checks. Insecure
 * or missing files resolve to null; in testing, passing null to the protocol handler
 * results in 404's in img and video tags.
 *
 * @param {string} chroniclesUrl The "chronicles://" URL to convert
 */
function validateChroniclesUrl(chroniclesUrl: string) {
  // NOTE: chroniclesUrl SHOULD start with chronicles://../_attachments/<filename>
  // NOTE: UI should also validate this, to tell user how to fix (if it comes up)
  if (!chroniclesUrl?.startsWith("chronicles://../_attachments")) {
    console.warn(
      "[validateChroniclesUrl]: chronicles:// file handler blocking access to file outside of _attachments directory",
    );
    return null;
  }

  // strip chronicles:// - so we can treat as a file path
  // strip ../ - we prepend the root directory (notesDir) to make absolute path
  const url = decodeURI(chroniclesUrl.slice("chronicles://../".length));
  const notesDir = settings.get("notesDir");
  if (!notesDir) {
    console.error(
      "[validateChroniclesUrl]: notesDir is not set - unable to load image",
    );
    return null;
  }

  const baseDir = path.join(notesDir);
  const absPath = path.join(baseDir, url);
  const normalizedPath = path.normalize(absPath);

  if (!isPathWithinDirectory(normalizedPath, baseDir)) {
    console.warn(
      "[validateChroniclesUrl]: chronicles:// file handler blocked access to file outside of user files directory:",
      normalizedPath,
    );

    return null;
  }

  if (!fs.existsSync(normalizedPath)) {
    console.warn(
      "[validateChroniclesUrl]: chronicles:// file handler could not find file:",
      normalizedPath,
      "[validateChroniclesUrl]: Maybe you need to set the notesDir or update broken file links?",
    );

    return null;
  }

  return normalizedPath;
}

// Checks if the resolved path is within the specified directory
function isPathWithinDirectory(resolvedPath: string, directory: string) {
  const relative = path.relative(directory, resolvedPath);
  return !relative.startsWith("..") && !path.isAbsolute(relative);
}

/**
 * Checks if a URL is safe for opening in external applications.
 * @param {string} urlString The URL to check.
 * @returns {boolean} True if the URL is considered safe, false otherwise.
 */
function isSafeForExternalOpen(urlString: string) {
  try {
    const parsedUrl = new url.URL(urlString);

    const allowedProtocols = ["http:", "https:", "mailto:"];
    if (allowedProtocols.includes(parsedUrl.protocol)) {
      return true;
    }
  } catch (error) {
    console.error("isSafeForExternalOpen - Error parsing URL:", error);
    return false;
  }

  return false;
}

/**
 * Handle opening web and file links in system default applications.
 * @param {string} url
 */
function handleLinkClick(url: string) {
  if (url.startsWith("chronicles://")) {
    const sanitized = validateChroniclesUrl(url);
    if (sanitized) {
      shell.showItemInFolder(sanitized);
    } else {
      console.warn("Blocked file navigation:", url);
    }
  } else if (isSafeForExternalOpen(url)) {
    shell.openExternal(url);
  } else {
    console.warn("Blocked navigation to:", url);
  }
}

app.on("web-contents-created", (event, contents) => {
  contents.on("will-navigate", (event, navigationUrl) => {
    // prevent navigation from the main window
    event.preventDefault();
    handleLinkClick(navigationUrl);
  });

  contents.setWindowOpenHandler(({ url }) => {
    handleLinkClick(url);
    // Prevent the creation of new windows
    // https://www.electronjs.org/docs/latest/tutorial/security#14-disable-or-limit-creation-of-new-windows
    return { action: "deny" };
  });
});

// use a wider width in dev to support attached debugger, since it re-opens on changes
// NOTE: In production this could be more sophisticated, remembering the users
// last width while also doing some sanity checks in case they change screen
const width = app.isPackaged ? 800 : 1400;

function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    backgroundColor: "#121212", // todo: match theme
    show: false, // hide until ready to avoid flash of white screen
    width,
    height: 600,

    // Hides the default (empty) window title
    titleBarStyle: "hidden",

    trafficLightPosition: { x: 10, y: 16 },
    webPreferences: {
      nodeIntegration: false,
      sandbox: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.bundle.mjs"),
    },
  });

  mainWindow.loadFile("index.html");
  mainWindow.once("ready-to-show", () => {
    if (!process.env.HEADLESS) {
      mainWindow?.show();
    }
  });

  if (!app.isPackaged) {
    // NOTE: These capture console.log messages from the renderer process, which
    // agents like Claude can use to debug.
    mainWindow.webContents.on("console-message", (event) => {
      console.log(`[RENDERER ${event.level}]:`, event.message);
    });

    mainWindow.webContents.openDevTools();
  }

  // Setup context menu with spell checking support
  contextMenu({
    window: mainWindow,
    showLearnSpelling: true,
    showLookUpSelection: true,
    showSearchWithGoogle: true,
    showInspectElement: !app.isPackaged,
  });
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

// Preferences in UI allows user to specify chronicles root
// and imports directories
ipcMain.on("select-directory", async (event, arg) => {
  if (!mainWindow) {
    console.error(
      "received request to open file picker but mainWindow is undefined",
    );
    return;
  }

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory", "createDirectory"],
  });

  const filepath = result.filePaths[0];

  // user selected cancel
  if (!filepath) {
    event.reply("directory-selected", {
      value: null,
      error: null,
    });
    return;
  }

  try {
    ensureDir(filepath);
  } catch (err) {
    console.error(
      `Error accessing directory ${filepath}; canceling update to notesDir`,
      err,
    );
    event.reply("directory-selected", {
      value: null,
      error: `Error accessing directory ${filepath}; canceling update to notesDir`,
    });
    return;
  }

  // NOTE: Do not change this name without updating UI handlers
  event.reply("directory-selected", {
    value: filepath,
    error: null,
  });
});

ipcMain.on("inspect-element", async (event, arg) => {
  if (!mainWindow) {
    console.error(
      "received request to open file picker but mainWindow is undefined",
    );
    return;
  }

  mainWindow.webContents.inspectElement(arg.x, arg.y);
});
