const Store = require("electron-store");

// https://github.com/sindresorhus/electron-store/issues/15
// docs are good: https://github.com/sindresorhus/electron-store
// todo: JSON Schema, etc
module.exports = new Store({
  name: "settings",
});
