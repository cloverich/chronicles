# Chronicles

**Status**: In development. Bugs abound. See releases to download the application. 


## Resetting database
I haven't setup migrations or database versioning. Between releases, you may need to reset the database. Two ways to do this:

- Find the sqlite database file and delete it
- Start the app with `CHRONICLES_RESCHEMA` to to true

## Development

All of the application code lives in the `/ui` directory. Ignore the others :)



The app is a typical Electron dev setup, but serves the UI from webpack dev server while in development. To start the app you'll need to start both the webpack dev server and electron.

```bash
# install dependencies
yarn

# start webpack
yarn dev

# start electron
# yarn dev:electron
```





## Build and release

- Use the `build.sh` script
- Make a Github release

