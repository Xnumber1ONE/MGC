// proxy.js
const http = require("http");
const https = require("https");

const PORT = 3000;

http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Methods", "*");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  const target = decodeURIComponent(req.url.slice(1));
  if (!target.startsWith("http")) {
    res.writeHead(400);
    return res.end("Missing target URL");
  }

  const headers = { ...req.headers };
  delete headers.host;
  delete headers.origin;
  delete headers.referer;

  https.get(target, { headers }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  }).on("error", (e) => {
    res.writeHead(500);
    res.end("Proxy error: " + e.message);
  });
}).listen(PORT, () => console.log(`Proxy running at http://localhost:${PORT}`));