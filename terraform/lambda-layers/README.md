# lambda-layers

For certain npm packages, that require architecture-specific build scripts, it's simpler to use a Lambda Layer, than to try to include that package in node_modules, and/or bundle the package into our dist file.

Some docs on Lambda Layers:
https://docs.aws.amazon.com/lambda/latest/dg/nodejs-layers.html

We've used this very helpful site to generate layers (as of writing, just one: `sqlite3`)
https://nodelayer.xyz/

We'll list the original source of each .zip here, but for simplicity / in case there's ever a disruption to the site, we'll commit these layers into source control, for the time being.


## Layers

1. `sqlite3`
```shell
# command provided on https://nodelayer.xyz/ 
curl -L --fail-with-body -o layer.zip "https://api.nodelayer.xyz/arm64/layers/generate?version=v20.19.2&packages=sqlite3"
```