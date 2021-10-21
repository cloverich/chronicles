# Chronicles

**Status**: Hobby project, in development. Prototyping hacks and ideas -- bugs abound. Will post usable(ish) versions as releases when it gets to stopping points. 



## Development
The app is a typical Electron dev setup, excepting the use of [esbuild][1]. 

```bash
# install dependencies
yarn

# start the development build and watch script
yarn start
```

See scripts/dev.js for specifics on how the source files are compiled and re-loaded in development. Settings 

## Build and release
- Read and use the `build.sh` script
- Make a Github release

At a high level, the build is comprised of:
- generate bundles ([esbuild][1]) from source files
- install production dependencies
- [re-build][2] native dependencies for the targeted electron version
- [package][3] the app


[1]: https://esbuild.github.io
[2]: https://github.com/electron/electron-rebuild
[3]: https://github.com/electron/electron-packager