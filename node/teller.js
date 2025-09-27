const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const https = require("https");

const APP_ID = process.env.APP_ID;
const ENV = process.env.ENV || "sandbox";
const CERT = process.env.CERT;
const CERT_KEY = process.env.CERT_KEY;
const PORT = process.env.PORT || 8001;

if (!APP_ID) {
  console.error("Error: APP_ID is required");
  process.exit(1);
}
if (["development", "production"].includes(ENV) && (!CERT || !CERT_KEY)) {
  console.error(`Error: CERT and CERT_KEY are required when ENV=${ENV}`);
  process.exit(1);
}

const staticDir = path.join(__dirname, "..", "static");

const app = express();
app.use(cors());

app.use(
  "/api",
  createProxyMiddleware({
    target: "https://api.teller.io",
    changeOrigin: true,
    pathRewrite: { "^/api": "" },
    agent:
      CERT && CERT_KEY
        ? new https.Agent({
            cert: fs.readFileSync(CERT),
            key: fs.readFileSync(CERT_KEY),
          })
        : undefined,
    onProxyReq: (proxyReq, req) => {
      const rawAuth = req.headers["authorization"];
      if (rawAuth) {
        const token = rawAuth.trim();
        const basic = Buffer.from(`${token}:`).toString("base64");
        proxyReq.setHeader("authorization", `Basic ${basic}`);
      }
    },
  })
);

app.get("/", (req, res) => {
  const htmlPath = path.join(staticDir, "index.html");
  let html = fs.readFileSync(htmlPath, "utf8");
  html = html.replace("{{ app_id }}", APP_ID);
  html = html.replace("{{ environment }}", ENV);
  res.type("html").send(html);
});

app.use("/static", express.static(staticDir));

app.listen(PORT, () => {
  console.log(`Listening on http://localhost:${PORT} (ENV=${ENV}, APP_ID=${APP_ID})`);
});