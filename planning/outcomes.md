# Planning-doc outcomes to record

For `unom/punktfunk-planning` `design/tizen-client-implementation-plan.md` (the planning repo was
unreachable from the implementing session: paste these in). Date: 2026-10-02.

## §0 status line

> **Status: T1, T2, T3 and T5 code landed on 2026-10-02 as PRs; every on-device gate is open.**
> T1 (`unom/punktfunk` branch `tizen/t1-mgmt-tunnel`, three commits) is a patch series awaiting the
> maintainer's push to Gitea. T2 is client-web #42, T3 #43 (stacked), T5's CI piece #44 (stacked);
> T3's console-kit half (`tizen/t3-console-platform`) and T5's docs page (`tizen/t5-docs`) are
> monorepo patch series. T4 has not run.

## §7 T1 — Host

**Result, 2026-10-02 — code done, gate open.** `tizen/t1-mgmt-tunnel` on `origin/main` @ `31c1f4c`:

- `security(host/webtransport): admit a plane session with no Origin` — D5, the test flipped, the
  Browser-origins docs line.
- `feat(host/mgmt): answer the plane bootstrap over plain HTTP` — the first-byte sniff in
  `serve_governed` (a flag only mgmt passes; `serve_https` and the nvhttp listener pass `None` and
  behave as before), `mgmt::bootstrap_app` holding one route behind the CORS layer, built only
  while `browser_plane` is on.
- `feat(host/webtransport): tunnel the management API over /mgmt` — `webtransport/mgmt.rs`:
  framing as §4.1, the caps as §4.1 plus a 30 s per-request read timeout (without it a silent
  stream would hold a slot and defeat the idle close), `PeerAddr` + `LocalAddr` +
  `PeerCertFingerprint(None)` on every request, dispatch into the one router `mgmt::run`
  publishes through a `OnceLock`. Paths are checked raw and percent-decoded; dot and empty segments
  are refused.

Tests as listed in §4.1 plus the header allowlist and the per-IP cap; 968/968 in `punktfunk-host`;
clippy `-D warnings`, fmt, check-writing and check-docs-drift clean. The five-point security
review is written (`T1-security-review.md`, for the PR body); point 5 is **recorded, not closed**.

**Gate:** not run (needs the Mac Studio). `_e2e.html?tunnel=1&host=<address>` is in client-web #42.

## §7 T2 — Client

**Result, 2026-10-02 — code done, gate open.** client-web #42, four commits. §4.2 as written, with
these choices: `HostTarget` gains `tunnel: true` and lives in `pf-connect.ts`; the bootstrap is one
GET that doubles as the reach probe (`ok` / `no-plane` on the host's own JSON 404 / `unreachable`);
`Host` takes the tunnel's fetch into both `connection` and `deviceKey`. The build mode emits
`config.xml` and `icon.png` from `apps/web/tizen/` and injects `$WEBAPIS/webapis/webapis.js`;
`tools/wgt.mjs` is a dependency-free zip writer; `tools/tizen-icon.mjs` renders the icon from the
brand mark. Package id `punktfunk0`, application id `punktfunk0.punktfunk`, widget id
`https://github.com/punktfunk/client-web/tizen`. The standby watch is in `app.ts` (`watchSleep`).
AV1 is withheld on Tizen in `decodableCodecs`; the WebGPU fallback already handled a null adapter.

**Gate:** not run.

## §7 T3 — Remote

**Result, 2026-10-02 — code done, gate open, re-pin pending.** client-web #43 (TS half) and the
monorepo branch `tizen/t3-console-platform` (`Platform::Tizen`: Web's rows, `GlyphStyle::Remote`,
`can_quit`, the codec row without AV1/PyroWave, a `tizen` flag on the bridge's `CreateOptions`;
tests `tizen_is_web_with_a_remote_and_an_exit`). Text entry uses `system_keyboard` on a set and
an offscreen input the set's IME types into; Back in a stream is the menu chord (`tvBack`); the
DOM sheets and the quick menu take arrows, Enter and Back. After the kit merges: re-pin the three
crates and switch `packages/stream/rust/host.rs` to `Platform::Tizen` when `opts.tizen`
(`after-repin.patch` in the handoff).

**Gate:** not run.

## §7 T4

Not started. Needs the monitor and a host build with T1.

## §7 T5

**Result, 2026-10-02 — partly done.** CI attaches `punktfunk-tizen-<version>.wgt` to `v*`
releases (client-web #44, unsigned zip). The install page `samsung-tv.md` is on the monorepo
branch `tizen/t5-docs`, linked from the clients index, the install table and the browser-client
page; its "what the TV app does" section states H.264/HEVC at up to 1080p60 and no AV1/HDR/4K
as the current scope, to be corrected by T4. The send-log line (model, Tizen version, firmware,
Chromium) is in #42. Not done: the Apps2Samsung proof and the catalog PR (maintainer's yes).

## `design/README.md` index line

`tizen-client-implementation-plan.md` — T1–T3 and T5 implemented 2026-10-02 (client-web #42–#44,
monorepo patch series `tizen/t1-mgmt-tunnel`, `tizen/t3-console-platform`, `tizen/t5-docs`);
gates and T4 await the monitor.
