#!/bin/bash

TAG=$1

echo $TAG | grep -q '^v[[:digit:]]\+\.[[:digit:]]\+\.[[:digit:]]\+$'
if [ $? -ne 0 ]
then
	echo "tag format: vN.N.N"
	exit 1
fi

npm run build

mkdir local_npm_registry-$TAG
cp -r README.md COPYING tsconfig.json package.json dist src package-lock.json local_npm_registry-$TAG/
pushd local_npm_registry-$TAG
npm version ${TAG:1}
npm ci --production
npm shrinkwrap --production
popd

TARBALL=local_npm_registry-$TAG.tar.gz
tar zcf $TARBALL local_npm_registry-$TAG
git tag $TAG
rm -r local_npm_registry-$TAG

echo ""
echo "Dist package: $TARBALL"
echo "Done."
