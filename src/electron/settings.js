// https://github.com/sindresorhus/electron-store/issues/15
// docs are good: https://github.com/sindresorhus/electron-store
// todo: JSON Schema, etc

let store;

async function getStore() {
  if (!store) {
    const { default: Store } = await import("electron-store");
    store = new Store({
      name: "settings",
    });
  }
  return store;
}

module.exports = { getStore };
