# punktfunk for Samsung TV

The punktfunk client for Samsung TVs, as a Tizen web app. It is the
[browser client](https://github.com/punktfunk/client-web) packaged as a `.wgt`: the same page,
started in Punktfunk Console for the remote, reaching the host through the browser plane because a
packaged page cannot `fetch` a self-signed host. Nothing is forked. This repository holds what the
package needs beyond the page: the manifest, the icon, the build that produces the `.wgt`, the
signing route, and the catalog entry.

Sets from 2024 on (Tizen 8.0, Chromium 108). A preview, sideloaded: Samsung's store does not carry
it, and a set only installs a package signed for its own DUID, so the release asset is unsigned and
each owner signs their copy.

**Install it:** [Samsung TV](https://docs.punktfunk.unom.io/docs/samsung-tv) on the docs site walks
through the host, the set's Developer Mode, Apps2Samsung or the command line, and pairing.

## What is in the box

| Path | What |
|---|---|
| `client-web.ref` | The client-web commit the package is built from. Bump it to ship a newer page. |
| `tizen/config.xml` | The widget manifest: package id `punktfunk0`, application id `punktfunk0.punktfunk`, the public privileges, game mode. `version` is set at build time. |
| `tizen/icon.png` | 512×423, rendered from the brand mark by `tools/icon.mjs`. |
| `tools/build.mjs` | Checks out client-web at the ref, builds it, adds Samsung's `webapis.js` to the page, drops the source maps, adds the manifest and icon, zips `build/punktfunk-tizen-<version>.wgt`. |
| `tools/sign.sh` | Signs the staged package for one set in the Tizen CLI container, and with `install` pushes and launches it there. |
| `tools/toolchain/Dockerfile` | Tizen SDK 10.0 `web-cli` (`tizen`, `sdb`) plus the Samsung certificate extension, as an amd64 image: Samsung ships `sdb` for Intel only. |
| `catalog/punktfunk__client-tizen.json` | The Apps2Samsung catalog entry, which reads this repository's releases. |
| `.github/workflows/ci.yml` | Builds the package on every push and pull request; a `v*` tag attaches it to the release. |

## Build

Needs what client-web needs: Node 24, the Rust toolchain its `rust-toolchain.toml` names, emsdk
6.0.10, and access to the `@punktfunk` and `@unom` npm scopes on `git.unom.io`.

```sh
npm run build                      # clones client-web at client-web.ref into client-web/, builds, packages
CLIENT_WEB=../client-web npm run build     # uses a checkout you already have, as it is
PF_APP_DIST=../client-web/apps/web/dist npm run build   # packages a dist/ you already built
```

The result is `build/app/` (the staged package) and `build/punktfunk-tizen-<version>.wgt`, where
the version is this repository's tag.

## Sign and install, by hand

Apps2Samsung does this for an owner. For development, or a set it does not reach:

```sh
docker build --platform linux/amd64 -t punktfunk-tizen-cli:10.0 tools/toolchain
# once per set: samsung-tv-cert --duid "$(sdb shell 0 getduid)" --profile punktfunk
tools/sign.sh                                   # build/app → build/punktfunk-tizen-<v>-signed.wgt
TV=192.168.1.50 tools/sign.sh install           # ... then sdb connect, install, launch
tools/sign.sh punktfunk-tizen-0.1.0.wgt         # sign a downloaded release asset instead
```

The script's header lists the three signing traps it handles. The DUID is the one `sdb shell 0
getduid` prints, not what `webapis.productinfo.getDuid()` returns.

## Release

Tag `vX.Y.Z` on `main`. CI builds the package from `client-web.ref` and attaches
`punktfunk-tizen-X.Y.Z.wgt` to the release; Apps2Samsung picks it up through the catalog entry.
To ship a newer page, bump `client-web.ref` first.

## Status

T0 (the probe as an app) is green on a Samsung Odyssey OLED G9 on Tizen 9.0. The host side (the
plain-HTTP bootstrap and the `/mgmt` tunnel), the client side (client-web) and this package are
implemented; the first install of this package on a set, the remote-only walk-through and the
measured first stream are still open. The gates and who runs them: `docs/handoff-2026-10-02.md`.

## License

MIT or Apache-2.0, as client-web.
