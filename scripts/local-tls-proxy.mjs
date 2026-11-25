// Local-only TLS adapters keep production origin validation intact during QA.
import https from "node:https";
import http from "node:http";
import { readFileSync } from "node:fs";
export function startLocalTls(apiPort = 54321) {
  const tls = {
    key: readFileSync("output/dev-a-db/tls.local.key"),
    cert: readFileSync("output/dev-a-db/tls.local.crt"),
  };
  const servers = [];
  for (const [port, target] of [
    [3143, 3102],
    [54325, apiPort],
  ]) {
    const server = https.createServer(tls, (request, response) => {
      const upstream = http.request(
        {
          hostname: "127.0.0.1",
          port: target,
          path: request.url,
          method: request.method,
          headers: { ...request.headers, "x-forwarded-proto": "https" },
        },
        (result) => {
          response.writeHead(result.statusCode ?? 502, result.headers);
          result.pipe(response);
        },
      );
      upstream.on("error", () => {
        if (response.destroyed) return;
        if (response.headersSent) {
          response.destroy();
          return;
        }
        response.writeHead(502);
        response.end("Local QA upstream not ready");
      });
      request.pipe(upstream);
    });
    server.listen(port, "127.0.0.1");
    servers.push(server);
  }
  return servers;
}
