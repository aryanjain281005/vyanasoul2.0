// Publish dist/ (built with --target=preview) to the gh-pages branch, which GitHub Pages serves.
// Run with: npm run deploy:preview
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dist = path.resolve(new URL("../dist", import.meta.url).pathname);
const robots = fs.readFileSync(path.join(dist, "robots.txt"), "utf8");
if (!robots.includes("Disallow: /\n")) {
  console.error("dist/ is a production build. Run `npm run build` (preview) before deploying the preview.");
  process.exit(1);
}
const git = (args, cwd) => execFileSync("git", args, { cwd, stdio: ["ignore", "pipe", "inherit"] }).toString().trim();
const remote = git(["remote", "get-url", "origin"], dist);
const sha = git(["rev-parse", "--short", "HEAD"], dist);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vs-preview-"));
fs.cpSync(dist, tmp, { recursive: true });
fs.writeFileSync(path.join(tmp, ".nojekyll"), ""); // serve files as they are, without Jekyll
git(["init", "-q", "-b", "gh-pages"], tmp);
git(["add", "-A"], tmp);
git(["-c", "user.name=Vyana Soul deploy", "-c", "user.email=deploy@vyanasoul.com", "commit", "-q", "-m", `Preview build of ${sha}`], tmp);
git(["push", "-q", "--force", remote, "gh-pages"], tmp);
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`Published the preview of ${sha} to gh-pages`);
