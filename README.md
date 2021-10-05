# Chronicles

**Status**: Hobby project, in development. Prototyping hacks and ideas -- bugs abound. Will post usable(ish) versions as releases when it gets to stopping points. 


## Migrating the database
:|

### Database file
The SQLite database file is specified in the [settings.json](https://github.com/nathanbuchar/electron-settings) file. It can be configured in preferences. 

## Development
The app is a typical Electron dev setup, but serves the UI from webpack dev server while in development. To start the app you'll need to start both the webpack dev server and electron.

```bash
# install dependencies
yarn

# start webpack
yarn dev

# start electron
yarn dev:electron
```

## Build and release

- Use the `build.sh` script
- Make a Github release

