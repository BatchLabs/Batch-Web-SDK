# Building Batch SDK

## Requirements

- Node 17+
- Yarn

## Steps

- Run `yarn`
- Run `yarn build`

See package.json for all available scripts.

## Deployment

Using this on your website will require you to edit the "static" URL of "webpack.hosts.config.js" and replicate the same structure as Batch's on your servers.

Assuming that you're trying to deploy version 3.3.0, the following URLs have to be present:

- https://<yourhost>/v3/bootstrap.min.js 
- https://<yourhost>/v3/worker.min.js
- https://<yourhost>/3.3.0/sdk.min.js
  - Any file present in the build/ folder should be in this folder
  - Any file present in resources/ should also be in this folder
- https://<yourhost>/manifest.json (download our manifest to see the expected format, or modify the bootstrap code)
