/* eslint-env node */
/* eslint-disable */

const path = require("path");

const PnpWebpackPlugin = require(`pnp-webpack-plugin`);
const TerserPlugin = require("terser-webpack-plugin");
const ForkTsCheckerWebpackPlugin = require("fork-ts-checker-webpack-plugin");
const webpack = require("webpack");
const sdkPackage = require("./package.json");

// Produces an optimized build if true. Default false.
const isProductionBuild = process.env.SDK_BUILD_LIKE_PRODUCTION == "0" ? false : true;
// WS URL to use. Default dev environment. SDK Code might also use this.
const targetEnvironment = process.env.SDK_TARGET_ENV || "dev";
// Enable rolling development (no sdk version number)
const rolling = process.env.ROLLING === "1";
// Enable sourcemaps on a production build
const enableProductionSourcemaps = process.env.SDK_PRODUCTION_SOURCEMAPS == "1";
// Are we running under a webpack dev server? SDK uses this to reference relative resources
// rather than via.batch.com.
const isWebpackDevServer = process.env.SDK_IS_WEBPACK_DEV_SERVER === "1";

const SDK_HOSTS = require("./webpack.hosts.config.js");

const plugins = [
  new webpack.DefinePlugin({
    BATCH_IS_WEBPACK_DEV_SERVER: isWebpackDevServer ? "1" : "0",
    BATCH_ENV: JSON.stringify(targetEnvironment),
    BATCH_STATIC_HOST: JSON.stringify(SDK_HOSTS[targetEnvironment].static),
    BATCH_WS_URL: JSON.stringify(SDK_HOSTS[targetEnvironment].ws),
    BATCH_SAFARI_WS_URL: JSON.stringify(SDK_HOSTS[targetEnvironment].safariWs),
    BATCH_ICONS_URL: JSON.stringify(SDK_HOSTS[targetEnvironment].icons),
    BATCH_SDK_VERSION: JSON.stringify(rolling ? "rolling" : sdkPackage.version),
    BATCH_SDK_MAJOR_VERSION: JSON.stringify(sdkPackage.majorVersion),
  }),
  new webpack.WatchIgnorePlugin({ paths: [/css\.d\.ts$/] }),
  new ForkTsCheckerWebpackPlugin(),
];

const entries = {
  bootstrap: "./src/public/browser/bootstrap.ts",
  sdk: "./src/public/browser/sdk.ts",
  worker: "./src/public/worker/worker.ts",
  button: "./src/public/browser/ui/button/button.ts",
  popin: "./src/public/browser/ui/popin/popin.ts",
  alert: "./src/public/browser/ui/alert/alert.ts",
  banner: "./src/public/browser/ui/banner/banner.ts",
  switcher: "./src/public/browser/ui/switcher/switcher.ts",
  native: "./src/public/browser/ui/native/native.ts",
  "public-identifiers": "./src/public/browser/ui/public-identifiers/public-identifiers.ts",
};

// Configure sourcemaps
let sourceMapMode;
if (isProductionBuild) {
  // If you tweak this, change terser options
  if (enableProductionSourcemaps) {
    sourceMapMode = "source-map";
  } else {
    sourceMapMode = undefined;
  }
} else {
  sourceMapMode = "inline-source-map";
}

const webpackConfig = {
  mode: "none",
  devtool: sourceMapMode,
  entry: entries,
  output: {
    path: path.resolve(__dirname, "build/"),
    publicPath: "/",
    filename: "[name].min.js",
    sourceMapFilename: "[name].map",
  },
  resolve: {
    extensions: [".ts", ".js"],
    alias: {
      "com.batch.dom": path.resolve(__dirname, "src/lib/dom"),
      "com.batch.shared": path.resolve(__dirname, "src/lib/shared"),
      "com.batch.translations": path.resolve(__dirname, "src/translations"),
      "com.batch.worker": path.resolve(__dirname, "src/lib/worker"),
    },
    plugins: [PnpWebpackPlugin],
  },
  resolveLoader: {
    plugins: [PnpWebpackPlugin.moduleLoader(module)],
  },
  plugins,
  module: {
    noParse: [/autoit.js/],
    rules: [
      {
        test: /\.(j|t)s$/,
        exclude: /(node_modules|bower_components)/,
        use: {
          loader: "babel-loader",
        },
      },
      {
        test: /\.html$/,
        exclude: /(node_modules|bower_components)/,
        use: {
          loader: "html-loader?-minimize",
          options: {
            attributes: false,
            esModule: true,
          },
        },
      },
      {
        test: /\.css$/,
        exclude: /(node_modules|bower_components)/,
        use: [
          "style-loader",
          {
            loader: "dts-css-modules-loader",
            options: {
              namedExport: false,
              banner: "// This file is generated automatically\nexport type IIndexableStyle = {[key in keyof IStyleCss]: string;};",
            },
          },
          {
            loader: "css-loader",
            options: {
              modules: true,
            },
          },
        ],
      },
    ],
  },
};

if (isProductionBuild) {
  webpackConfig.optimization = {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        parallel: true,
        sourceMap: enableProductionSourcemaps,
        terserOptions: {
          mangle: false,
        },
      }),
    ],
  };
}

module.exports = webpackConfig;
