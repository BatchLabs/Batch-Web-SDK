/* eslint-env node */
const hosts = {
  prod: {
    static: "via.batch.com",
    ws: "https://ws.batch.com/web",
    icons: "https://icons.batch.com",
  },
};

hosts.dev = hosts.prod;
hosts.staging = hosts.prod;
hosts.preprod = hosts.prod;

module.exports = hosts;
