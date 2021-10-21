#!/bin/sh
set -e

# Pardon the comments, my shell is weak
# leaving myself lots of syntax reminders
# https://stackoverflow.com/questions/4341630/checking-for-the-correct-number-of-arguments

# Fail if incorrect number of arguments
if [ "$#" -ne 1 ]; then
  echo "Usage: $0 BUILD NUMBER" >&2
  exit 1
fi


rm -rf dist/

mkdir -p ./packaged
outdir="./packaged/${1}"
echo "Creating build directory at $outdir"

# Build out directory already exists
if [ -e outdir ]; then
  echo "$outdir already exists. Increment build number." >&2
  exit 1
fi

# Found but not directory
# if ! [ -d "$1" ]; then
#   echo "$1 not a directory" >&2
#   exit 1
# fi

# copy contents of electron folder to dist/
# even though we compile it below... it requires the migrations folder....
# TODO: Can it be pulled in as a dependency with a loader!?
echo "Copying electron folder"
mkdir -p dist/electron
cp -r src/electron dist
cp src/index.html dist/index.html

# Delete any previously generated bundles
# In case we were changing names or something like that.
rm -rf src/*.bundle.*


# compile ui files to dist
node ./scripts/production.js

# copy all bundled assets
cp -r src/*.bundle.* dist/

# copy package.json, required by electron to know how to start
cp package.json dist/
cp yarn.lock dist/

# Called from yarn postinstall; more context in the rebuild script
cp ./rebuild-better-sqlite3.sh dist/

# todo: This is installing dev dependencies which, because of esbuild, should not be needed.
# When I use install --production, the final build complains it cannot find electron
# Could probably just install --production then manually add electron? Or munge the copied
# package.json to remove all devDependencies except electron
# This will produce a smaller final install for end users, because the package step
# copies the node modules installed here into the final package
cd dist/
yarn

cd ../

# package the application
# npx electron-packager dist/ --out $outdir
node package.js dist/ $outdir
