# Chronicles

**Status**: Hobby project, in development. Prototyping hacks and ideas -- bugs abound. Will post usable(ish) versions as releases when it gets to stopping points. 


## Migrating the database
This project is using Prisma. If there are changes to the `schema.prisma` file, a script in the project auto-runs migrations and re-generates the prisma client. However, before finalizing generate migrations:

```
npx prisma migrate dev --name <name_goes_here>
```

This won't work in production: https://github.com/cloverich/chronicles/issues/63 and the long term solution to migrations and the backend architecture / db in general is tbd. 

### Database file
The SQLite database file is designated by an environment variable (`DATABASE_URL`) specified in the [settings.json](https://github.com/nathanbuchar/electron-settings) file. It can be configured in preferences. But see above.

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

