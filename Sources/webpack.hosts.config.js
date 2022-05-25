/* eslint-env node */
const hosts = {
  prod: {
    static: "via.batch.com",
    ws: "https://ws.batch.com/web",
    safariWs: "https://safari-ws.batch.com",
    icons: "https://icons.batch.com",
  },
};

hosts.dev = hosts.prod;
hosts.staging = hosts.prod;
hosts.preprod = hosts.prod;

module.exports = hosts;
