module.exports = api => {
  api.cache(true);
  return {
    presets: [["@babel/preset-env", { exclude: [], modules: "auto", debug: false, useBuiltIns: false }]],
    plugins: [
      "@babel/plugin-transform-typescript",
      "@babel/plugin-proposal-export-namespace-from",
      "@babel/plugin-proposal-object-rest-spread",
      "@babel/plugin-proposal-class-properties",
      "@babel/plugin-proposal-private-methods",
    ],
  };
};
