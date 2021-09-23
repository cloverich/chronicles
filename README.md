# Chronicles

**Status**: Hobby project, in development. Prototyping hacks and ideas -- bugs abound. Will post usable(ish) versions as releases when it gets to stopping points. 


## Migrating the database
This project is using Prisma. If there are changes to the `schema.prisma` file, re-generate the client:

```
npx prisma generate
```

### Database file
The SQLite database file is designated by an environment variable (`DATABASE_URL`) specified in the [settings.json](https://github.com/nathanbuchar/electron-settings) file. 


### Legacy Code and notes
I haven't setup migrations or database versioning. Between releases, you may need to reset the database. Two ways to do this:

- Find the sqlite database file and delete it
- Start the app with `CHRONICLES_RESCHEMA` to to true

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

