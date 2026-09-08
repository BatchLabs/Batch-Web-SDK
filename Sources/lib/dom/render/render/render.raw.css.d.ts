// The webpack `asset/source` rule for `*.raw.css` imports this file as a plain
// string. See webpack.config.js. The string goes into the Shadow DOM stylesheet.
declare const css: string;
export default css;
