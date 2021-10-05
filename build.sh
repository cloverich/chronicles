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
echo "Copying electron folder"
cp -r src/electron dist/

# todo: inspect database and determine if migrations were generated
# ...this is a post-build, pre-release integration test

# Generate prisma database client
# Then copy it to the output directory
# NOTE: Does this account for native binaries? ¯\_(ツ)_/¯ 
# https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference#binarytargets-options
npx prisma generate
cp -r src/prisma dist/prisma

# compile server code, which is typescript, to dist
echo "Compiling backend typescript and outputting to $outdir"
npx tsc --outDir dist/

# compile ui files to dist
npx webpack --config webpack.js

# copy package.json, required by electron to know how to start
cp package.json dist/
cp yarn.lock dist/

# todo: This is installing dev dependencies which, because of webpack, should not be needed.
# When I use install --production, the final build complains it cannot find electron. Sigh.
cd dist/ && yarn

cd ../

# package the application
# npx electron-packager dist/ --out $outdir
node package.js dist/ $outdir
