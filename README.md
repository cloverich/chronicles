# Chronicles

**Status**: In development. Bugs abound. See releases to download the application. 



## Development

All of the application code lives in the `/ui` directory. Ignore the others :)



The app is a typical Electron dev setup, but serves the UI from webpack dev server while in development. To start the app you'll need to start both the webpack dev server and electron.

```bash
cd ui

# install dependencies
yarn

# start webpack
yarn dev

# start electron
# yarn dev:electron
```





## Build and release

- Use the `ui/build.sh` script
- Make a Github release

