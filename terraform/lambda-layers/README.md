# lambda-layers

For certain NPM packages, that require architecture-specific build scripts, it's simpler to use a Lambda Layer, than to try to include that package in node_modules, and/or bundle the package into our dist file.

Some docs on Lambda Layers:
https://docs.aws.amazon.com/lambda/latest/dg/nodejs-layers.html

We've used this very helpful site to generate layers for NPM packages:
https://nodelayer.xyz/

(note: as of 2025-06-02, we are *not* using any NPM packages as Layers, but we could in the future)

We also might need Lambda Layers for OS/terminal dependencies (i.e. _not_ NPM packages). We'll list those here as well.



## Layers

1. `ffmpeg` - for media processing

Retrieve from https://johnvansickle.com/ffmpeg/ - `ffmpeg-release-arm64-static.tar.xz`

Saved in this directory (.gitignored) as `/terraform/lambda-layers/ffmpeg-release-arm64-static.tar.xz`