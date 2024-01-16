# Chronicles
Electron based markdown journaling application, in the spirit of [incremental note taking][incr-notes]. 

**Status**: Hobby project, prototyping and re-working UX to try out various concepts with little regard for usability, stability, or appearances. Will remove this clause when I can guarantee your notes won't *poof* and the experience isn't confusing. Reach out if you are interested in journaling concepts and I'll provide a tour.

Tech stack:
- Electron and esbuild
- Typescript
- React and mobx
- Slate and Plate (Notion style WSYIWYG)


## Development
The app is a typical Electron dev setup, excepting the use of [esbuild][1]. 

```bash
# install dependencies
yarn

# start the development build and watch script
yarn start

# If error with sqlite library versions
yarn run electron-rebuild
```

See scripts/dev.js for specifics on how the source files are compiled and re-loaded in development. 

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
[incr-notes]: https://thesephist.com/posts/inc/