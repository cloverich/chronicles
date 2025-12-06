// This file called from electron-test-runner with a test file as process.argv[2]
// The test file ^ has assertions and need run in a preload script; this file
// stands up a BrowserWindow with the test file as a preload.
import { app, BrowserWindow } from "electron";
import electronStore from "electron-store";
import path from "path";
import { fileURLToPath } from "url";

// Initialize electron-store IPC for renderer process
electronStore.initRenderer();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

// Get test file from command line argument
const testFile = process.argv[2];
if (!testFile) {
  console.error("Usage: electron electron-test-entry.mjs <test-file>");
  process.exit(1);
}

app.whenReady().then(async () => {
  try {
    const win = new BrowserWindow({
      show: false, // headless
      webPreferences: {
        preload: path.resolve(projectRoot, testFile),
        contextIsolation: false, // Allow test code to access globals
        nodeIntegration: true,
      },
    });

    // Track if tests signaled completion
    let testExitCode = null;

    // Listen for test completion via IPC
    // NOTE: https://github.com/cloverich/chronicles/issues/374
    win.webContents.on("ipc-message", (_event, channel, ...args) => {
      if (channel === "test-complete") {
        testExitCode = args[0] || 0;
        console.log(`Tests completed with exit code: ${testExitCode}`);
        app.exit(testExitCode);
      }
    });

    win.webContents.on("console-message", (event) => {
      console.log(`[RENDERER ${event.level}]:`, event.message);
    });

    // Create a minimal HTML page that will trigger preload execution
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Electron Test Runner</title>
        </head>
        <body>
          <h1>Running Tests...</h1>
          <div id="test-output"></div>
          <script>
            // Tests will run via preload script
            // console.log('Test runner HTML loaded');
          </script>
        </body>
      </html>
    `;

    // Load the HTML content
    await win.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`,
    );

    // console.log("Electron test environment ready, tests should be running...");

    // Keep the process alive for a bit to allow tests to complete
    // If tests don't signal completion via IPC, timeout after 60s
    setTimeout(() => {
      if (testExitCode === null) {
        console.log("Test execution timeout (60s), exiting...");
        app.exit(1); // Exit with error code on timeout
      }
    }, 60000); // 60 second timeout
  } catch (error) {
    console.error("Error setting up Electron test environment:", error);
    app.exit(1);
  }
});

// Handle app quit events
app.on("window-all-closed", () => {
  app.quit();
});

app.on("activate", () => {
  // Do nothing
});
