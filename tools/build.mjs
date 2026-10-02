// The Samsung TV package from the browser client: build client-web at the pinned ref, add the
// Tizen files beside the page, zip it as an unsigned `.wgt`.
//
//   node tools/build.mjs                     clone client-web at client-web.ref, build, package
//   CLIENT_WEB=../client-web node tools/build.mjs
//                                            use that checkout as it is (its ref is not checked)
//   PF_APP_DIST=path/to/dist node tools/build.mjs
//                                            skip the client build: package an existing dist/
//
// Output: build/app/ (the staged package) and build/punktfunk-tizen-<version>.wgt. The version
// is this repository's tag (`git describe`), numeric part only, which is all a widget's
// `version` may hold. Signing is a separate step (tools/sign.sh): a set only installs a package
// signed for its own DUID, so the release asset stays unsigned and each owner signs their copy.
//
// What the page needs that the web build does not give it: Samsung's `webapis.js` on the page
// (its path exists only on the set, so it is never bundled), no source maps (a set has no devtools
// to read them and they are half the size), `config.xml` and the icon at the package root.

import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { zip } from "./wgt.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const build = join(root, "build");
const stage = join(build, "app");
const ref = readFileSync(join(root, "client-web.ref"), "utf8").trim();

const sh = (cmd, args, opts = {}) => {
  console.log(`$ ${[cmd, ...args].join(" ")}${opts.cwd ? `   (in ${opts.cwd})` : ""}`);
  execFileSync(cmd, args, { stdio: "inherit", ...opts });
};

/** This repository's version as the widget carries it: `0.1.0` from `v0.1.0-3-gabc`, `0.0.1` untagged. */
function version() {
  try {
    const described = execFileSync("git", ["describe", "--tags", "--always"], { cwd: root, encoding: "utf8" }).trim();
    return /\d+\.\d+\.\d+/.exec(described)?.[0] ?? "0.0.1";
  } catch {
    return "0.0.1";
  }
}

/** A client-web checkout at the pinned ref: the one `CLIENT_WEB` names, else `client-web/` here. */
function checkout() {
  if (process.env.CLIENT_WEB) return resolve(process.env.CLIENT_WEB);
  const dir = join(root, "client-web");
  if (!existsSync(join(dir, ".git"))) {
    sh("git", ["clone", "--no-checkout", "https://github.com/punktfunk/client-web", dir]);
  }
  sh("git", ["fetch", "--depth", "1", "origin", ref], { cwd: dir });
  sh("git", ["checkout", "--force", "--detach", ref], { cwd: dir });
  return dir;
}

/** The page as the web build makes it: the wasm and the library first, then the app. */
function buildClient(dir) {
  sh("npm", ["ci", "--no-audit", "--no-fund"], { cwd: dir });
  sh("npm", ["run", "build", "-w", "@punktfunk/stream"], { cwd: dir });
  sh("npm", ["run", "build", "-w", "punktfunk-web"], { cwd: dir });
  return join(dir, "apps", "web", "dist");
}

/** Every file under `dir`, as `[zip path, absolute path]`, `config.xml` first. */
function files(dir) {
  const out = [];
  const walk = (d, prefix) => {
    for (const name of readdirSync(d).sort()) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p, `${prefix}${name}/`);
      else out.push([`${prefix}${name}`, p]);
    }
  };
  walk(dir, "");
  out.sort(([a], [b]) => (a === "config.xml" ? -1 : b === "config.xml" ? 1 : a < b ? -1 : 1));
  return out;
}

/** The staged package: the page without its maps, Samsung's script on it, the manifest, the icon. */
function packageDist(dist, v) {
  rmSync(stage, { recursive: true, force: true });
  mkdirSync(stage, { recursive: true });
  cpSync(dist, stage, { recursive: true });
  for (const [rel, abs] of files(stage)) {
    if (rel.endsWith(".map")) {
      rmSync(abs);
    } else if (/\.(js|css)$/.test(rel)) {
      const text = readFileSync(abs, "utf8");
      const stripped = text.replace(/\n?\/[/*]# sourceMappingURL=\S+\s*(\*\/)?\s*$/, "\n");
      if (stripped !== text) writeFileSync(abs, stripped);
    }
  }
  const index = join(stage, "index.html");
  const html = readFileSync(index, "utf8");
  if (!html.includes("webapis.js")) {
    const tag = '<script src="$WEBAPIS/webapis/webapis.js"></script>';
    const at = html.indexOf("<meta charset");
    const end = at < 0 ? 0 : html.indexOf(">", at) + 1;
    writeFileSync(index, `${html.slice(0, end)}\n${tag}${html.slice(end)}`);
  }
  const config = readFileSync(join(root, "tizen", "config.xml"), "utf8").replace(/version="[^"]*"/, `version="${v}"`);
  writeFileSync(join(stage, "config.xml"), config);
  cpSync(join(root, "tizen", "icon.png"), join(stage, "icon.png"));
  const list = files(stage);
  const out = join(build, `punktfunk-tizen-${v}.wgt`);
  writeFileSync(out, zip(list.map(([rel, abs]) => [rel, readFileSync(abs)])));
  return { out, count: list.length };
}

const v = version();
const dist = process.env.PF_APP_DIST ? resolve(process.env.PF_APP_DIST) : buildClient(checkout());
if (!existsSync(join(dist, "index.html"))) {
  console.error(`build: ${dist} has no index.html`);
  process.exit(1);
}
const { out, count } = packageDist(dist, v);
console.log(`wgt: ${out} (${count} files, version ${v}, client-web ${process.env.PF_APP_DIST ? "from " + dist : ref.slice(0, 9)}, unsigned)`);
