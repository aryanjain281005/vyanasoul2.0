// Serve dist/ locally, the way the host will: npm run build && npm run dev
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("../dist", import.meta.url).pathname);
const port = Number(process.env.PORT || 8000);
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".webp": "image/webp", ".jpg": "image/jpeg", ".png": "image/png", ".woff2": "font/woff2", ".json": "application/json", ".xml": "application/xml", ".txt": "text/plain; charset=utf-8" };
if (!fs.existsSync(root)) { console.error("No dist/ yet. Run: npm run build"); process.exit(1); }

http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  const file = path.join(root, p);
  const ok = file.startsWith(root) && fs.existsSync(file) && fs.statSync(file).isFile();
  const send = ok ? file : path.join(root, "404.html");
  res.writeHead(ok ? 200 : 404, { "Content-Type": types[path.extname(send)] || "application/octet-stream" });
  fs.createReadStream(send).pipe(res);
}).listen(port, () => console.log(`Serving dist/ at http://localhost:${port}`));
