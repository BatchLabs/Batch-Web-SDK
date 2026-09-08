const path = require("path");

const TerserPlugin = require("terser-webpack-plugin");
const webpack = require("webpack");
const sdkPackage = require("./package.json");
const browserFloor = require("./scripts/browser-floor.cjs");

// Produces an optimized build if true. Default false.
const isProductionBuild = process.env.SDK_BUILD_LIKE_PRODUCTION != "0";
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
    "process.env.BATCH_IS_WEBPACK_DEV_SERVER": JSON.stringify(isWebpackDevServer ? "1" : "0"),
    "process.env.BATCH_ENV": JSON.stringify(targetEnvironment),
    "process.env.BATCH_STATIC_HOST": JSON.stringify(SDK_HOSTS[targetEnvironment].static),
    // `build:e2e-prod` also sets SDK_IS_WEBPACK_DEV_SERVER=1, so only the dev target uses the local proxy.
    "process.env.BATCH_WS_URL": JSON.stringify(
      isWebpackDevServer && targetEnvironment === "dev" ? "http://localhost:8010" : SDK_HOSTS[targetEnvironment].ws
    ),
    "process.env.BATCH_ICONS_URL": JSON.stringify(SDK_HOSTS[targetEnvironment].icons),
    "process.env.BATCH_SDK_VERSION": JSON.stringify(rolling ? "rolling" : sdkPackage.version),
    "process.env.BATCH_SDK_MAJOR_VERSION": JSON.stringify(sdkPackage.majorVersion),
  }),
  new webpack.WatchIgnorePlugin({ paths: [/css\.d\.ts$/] }),
];

const entries = {
  bootstrap: "./src/public/browser/bootstrap.ts",
  sdk: "./src/public/browser/sdk.ts",
  "landing-page": "./src/public/browser/landing-page/landing-page-bootstrap.ts",
  worker: "./src/public/worker/worker.ts",
  button: "./src/public/browser/ui/button/button.ts",
  popin: "./src/public/browser/ui/popin/popin.ts",
  alert: "./src/public/browser/ui/alert/alert.ts",
  banner: "./src/public/browser/ui/banner/banner.ts",
  switcher: "./src/public/browser/ui/switcher/switcher.ts",
  native: "./src/public/browser/ui/native/native.ts",
  "public-identifiers": "./src/public/browser/ui/public-identifiers/public-identifiers.ts",
};

// Dev-only messaging playground bundle: `sdk.ts` must never import it.
if (targetEnvironment === "dev") {
  entries["demo-api"] = "./src/public/browser/demo-api.ts";
}

if (process.env.SDK_DEMO_API_ONLY === "1") {
  for (const name of Object.keys(entries)) {
    delete entries[name];
  }
  entries["demo-api"] = "./src/public/browser/demo-api.ts";
}

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
    extensions: [".ts", ".js", ".d.ts"],
    alias: {
      "com.batch.dom": path.resolve(__dirname, "src/lib/dom"),
      "com.batch.shared": path.resolve(__dirname, "src/lib/shared"),
      "com.batch.translations": path.resolve(__dirname, "src/translations"),
      "com.batch.worker": path.resolve(__dirname, "src/lib/worker"),
    },
  },
  plugins,
  module: {
    rules: [
      {
        test: /\.(j|t)s$/,
        exclude: /(node_modules|bower_components)/,
        use: {
          loader: "oxc-webpack-loader",
          options: {
            // scripts/browser-floor.cjs owns the floor and explains why it must not
            // be lowered; the minifier pins below read the matching `ecma` from it.
            target: browserFloor.target,
            // Babel-loose-equivalent assumptions to shrink emitted helpers.
            // pureGetters stays OFF: on oxc-transform 0.139 it lowered `obj.method?.()`
            // to `_m()`, losing the receiver ("Illegal invocation" on Element#focus).
            // Re-enabling it needs a fresh prod-bundle e2e run.
            assumptions: {
              setPublicClassFields: true,
              noDocumentAll: true,
            },
          },
        },
      },
      {
        test: /\.html$/,
        exclude: /(node_modules|bower_components)/,
        use: {
          loader: "html-loader",
          options: {
            // `attributes: false` became `sources: false` in html-loader 2, and the
            // legacy `?-minimize` query became this option. The templates ship as
            // written: no attribute rewriting, no minification.
            sources: false,
            minimize: false,
            esModule: true,
          },
        },
      },
      {
        // The render engine imports raw CSS as a plain string. It injects that string into the Shadow DOM.
        test: /\.raw\.css$/,
        exclude: /(node_modules|bower_components)/,
        type: "asset/source",
      },
      {
        test: /\.css$/,
        exclude: [/(node_modules|bower_components)/, /\.raw\.css$/],
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
              esModule: true,
              modules: {
                // css-loader 7 defaults `namedExport` to true, which would break the
                // `import styles from "./style.css"` default-import convention, and
                // `exportLocalsConvention` to camelCase; both are pinned to the
                // pre-7 behaviour so the class names stay as authored.
                namedExport: false,
                exportLocalsConvention: "as-is",
              },
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
    // mode is "none", so production graph optimizations must be opted into
    // explicitly: scope hoisting + tree shaking of unused exports.
    concatenateModules: true,
    usedExports: true,
    innerGraph: true,
    sideEffects: true,
    providedExports: true,
    mangleExports: "size",
    moduleIds: "size",
    chunkIds: "size",
    minimizer: [
      new TerserPlugin({
        // SWC minifier: measured smaller and faster than terser 5 and esbuild here,
        // and @swc/core is already a project dependency (@swc/jest).
        minify: TerserPlugin.swcMinify,
        parallel: true,
        // Source maps are auto-detected from `devtool` since terser-webpack-plugin 5.
        terserOptions: {
          // Standard variable mangling only: property names are never mangled,
          // so the public API surface and webservice payloads are untouched.
          mangle: true,
          // The minifier may only emit syntax up to the floor's ceiling. Guards
          // against a @swc/core bump silently modernizing the output;
          // `yarn check-bundles` re-verifies the emitted artifacts.
          compress: { ecma: browserFloor.ecma },
          format: { ecma: browserFloor.ecma },
        },
      }),
    ],
  };
}

module.exports = webpackConfig;
