#

<div align="center">
    <img src="icons/src/input_icon.png" width="200" height="200">
  <h1>Chronicles</h1>
  <p>
    <b>Journaling for the absent minded</b>
  </p>
  <br>
  <br>
  <br>
</div>

**Status**: Experimental. This application is still in the prototype phase, the UX, functionality, and storage format may change at any time and with little regard for usability, stability, or appearances. However breaking changes will be called out in [releases](https://github.com/cloverich/chronicles/releases) and upcoming changes may be found in pinned issues; see the [roadmap](https://github.com/cloverich/chronicles/issues/160) for the longer term plan. As long as the application is developed it will be kept up to date.

## Development

The app is a typical Electron dev setup, excepting the use of [esbuild][1].

```bash
# install dependencies
yarn

# start the development build and watch script
yarn start

# If error with sqlite library versions
yarn run electron-rebuild --force
```

See scripts/dev.js for specifics on how the source files are compiled and re-loaded in development.

### Tech stack

- Electron and esbuild
- Typescript
- React and mobx
- Slate and Plate (Notion style WSYIWYG)

## Testing

- Use `yarn test` to run unit tests (67 tests via node:test)
- Use `ELECTRON_DISABLE_SECURITY_WARNINGS=true yarn test:electron` for preload/backend tests (local validation, no CI support)
- No end to end testing yet - would require [custom test driver](https://www.electronjs.org/docs/latest/tutorial/automated-testing#using-a-custom-test-driver), subprocess-per-test, or [mocked Electron APIs](https://github.com/cloverich/chronicles/issues/374)

Tests use esbuild for bundling. Electron tests (`.electron-test.ts`) run via custom harness loading tests as preload scripts.

## Build and release (MacOS)

Builds are run locally; the build output is manually uploaded to Github releases. As of this writing, only MacoS is supported; PRs for Windows or Linux support are welcome, but open an issue with a suggested plan first (it may require multiple changes).

- Tag the latest commit
- Use `yarn build`
- Delete the .app file, keep the .pkg file; zip the contents
- Make a Github release; attach the build output (zip file)

At a high level, the build is comprised of:

- generate bundles ([esbuild][1]) from source files
- install production dependencies
- [re-build][2] native dependencies for the targeted electron version
- [package][3] the app and [sign it][4]

### OSX Certificates

To sign the application, you need the signing certificate from Apple. Electron has good documentation on this process. This is roughly:

- Create and pay for an Apple developer account
- Generate certificates in xcode
- Export them; install them to local keychain
- The build process picks up this info and prompts you for them, "Allow all" (it signs repeatedly)

This is only necessary for official releases. If you want to download this repo, customize it, and build your test changes, comment out the osx sign attribute in `package.js` and run `yarn build`, then check the `packaged` directory for the latest build.

[1]: https://esbuild.github.io
[2]: https://github.com/electron/electron-rebuild
[3]: https://github.com/electron/electron-packager
[incr-notes]: https://thesephist.com/posts/inc/
[4]: https://github.com/electron/osx-sign
