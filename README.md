
Certain build environments like the [Open Build Service](https://build.opensuse.org/) require applications to be built without network access. This guarantees that sources are not altered during the actual build. The downside for Node applications is inability to run `npm install`. This proxy does two things

* it reads NPM published tarballs and presents them on a localhost interface
* it runs `npm install`

