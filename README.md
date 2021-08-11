
Certain build environments like the [Open Build Service](https://build.opensuse.org/) require applications to be built without network access. This guarantees that sources are not altered during the actual build. The downside for Node applications is inability to run `npm install`. This proxy does two things

* it reads NPM published tarballs and presents them on a localhost interface
* it configures npm to use this interface as the registry to resolve dependencies via `npm config set registry`
* it runs `npm` with any parameters and then shuts down

- [Installation](#installation)
  - [From Release](#from-release)
  - [From Git](#from-git)
- [Usage](#usage)
- [Open Build Service](#open-build-service)

# Installation

## From Release
`npm install --production`

## From Git
```
npm install
npm run build
```

At this point the application is in `dist/` and can be used as from a tagged released version

# Usage

From the directory of an application where you want to run `npm install`,

```
NM_TGZ = (list of all NPM tgz tarballs or directories containing them)
node $path_to_this_app/dist ${NPM_TGZ} $npm_params
```
All parameters that are not directories or NPM tarballs are passed as
parameters to NPM.

When running under OBS with `BuildRequires: local-npm-registry`, where
all dependencies are provides are tarballs in the `%_sourcedir`, then
you can just do,

```
local-npm-registry %{_sourcedir} install --also=dev
```

This will result in registry parsing all tarballs in `%_sourcedir` and
everything else is passed on to `npm` resulting in command-line on the
child process,

```
npm install --also=dev
```

This then connects to the localhost service and can only resolve the
provided NPM packages.


# Open Build Service

You can find this package in `devel:languages:javascript`
