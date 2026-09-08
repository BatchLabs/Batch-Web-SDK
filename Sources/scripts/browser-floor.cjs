// Single source of truth for the shipped browser floor: `target` is what the oxc
// loader lowers to, `ecma` the ceiling the minifier may emit and the gate parses.
// CJS on purpose — webpack.config.js is CJS and Node's ESM loader reads it too.
//
// Never lower it: below es2018 oxc moves `async` bodies into a closure and its
// `super.method()` rewrite then drops the receiver behind a TS type assertion.
module.exports = {
  target: ["chrome63", "firefox57", "edge79", "safari16"],
  ecma: 2018,
};
