# Tizen client — implementation handoff (2026-10-02)

The work for `design/tizen-client-implementation-plan.md` (planning `main` @ `6f6c989`), done from a
cloud session that could reach GitHub but not `git.unom.io`. Everything that could be pushed is
pushed; everything bound for Gitea is here as a patch series. Every on-device gate is open.

## Where things are

| Package | What | Where | State |
|---|---|---|---|
| T1 host | plaintext bootstrap, `/mgmt` tunnel, D5, docs line | `patches/monorepo/t1/` (3 patches on `unom/punktfunk` `main` @ `31c1f4c`) | code + tests done; not pushed; gate open |
| T2 client | `tunnel.ts`, bootstrap, injection, `--mode tizen`, `.wgt`, lifecycle, codec/WebGL2 gates | client-web [#42](https://github.com/punktfunk/client-web/pull/42), branch `tizen/t2-tunnel-and-packaging` | PR open; gate open |
| T3 remote | Back, HUD and sheets by remote, IME text entry, Quit → exit, console-first | client-web [#43](https://github.com/punktfunk/client-web/pull/43) (on #42) | PR open; gate open |
| T3 console kit | `Platform::Tizen` in `pf-console-ui` + bridge flag + test | `patches/monorepo/t3-console-kit/` (1 patch on `main` @ `31c1f4c`) | code + tests done (396/396 kit tests); not pushed |
| T3 re-pin | the three crate pins + one line in `rust/host.rs` | `patches/client-web/after-repin.patch` (instructions) | after the kit merges |
| T4 | measured first stream | — | not started |
| T5 CI | `.wgt` on `v*` releases | client-web [#44](https://github.com/punktfunk/client-web/pull/44) (on #42) | PR open |
| T5 docs | `samsung-tv.md` + links | `patches/monorepo/t5-docs/` | done; not pushed |
| T5 catalog | Apps2Samsung PR | — | needs the maintainer's yes (outward publish) |
| T5 diagnostics line | model, Tizen version, firmware, Chromium in the sent log | in #42 (`logs.ts`) | done |

The security review for the T1 PR body is `review/T1-security-review.md`. The outcome text for the
planning doc and its index is `planning/outcomes.md`.

## What the maintainer does next, in order

1. **T1 to Gitea.** In the monorepo at `origin/main`: `git am patches/monorepo/t1/*.patch`, push
   as `tizen/t1-mgmt-tunnel`, open the PR with `review/T1-security-review.md` as the body's review
   section. Gates it passed here: `cargo test -p punktfunk-host` (968/968), clippy `-D warnings`,
   fmt, `check-writing.sh`, `check-docs-drift.sh`. The patches apply on `31c1f4c`; the GitHub
   mirror was at that commit when they were made.
2. **T1 gate** (Mac Studio, host `.21` rebuilt with T1): check out client-web `tizen/t2-tunnel-and-packaging`,
   `PF_HOST` unset, `npx vite` in `apps/web`, open
   `http://127.0.0.1:5173/_e2e.html?tunnel=1&host=192.168.1.21` in Safari. Pairs (Request access
   or `&pin=`) and lists the library through the tunnel; the page-server and direct paths still work
   as before. With Browser origins set on the host, the TV (and this page, which sends an
   `http://127.0.0.1:5173` origin that is not listed) must still be admitted to the plane — the
   page's CORS read of the bootstrap needs its origin listed or the list empty, so test D5 with the
   TV, not Safari.
3. **T2 gate** (monitor, ask before each install): on the Mac Studio with emsdk,
   `npm run build:tizen` in client-web at `tizen/t2-tunnel-and-packaging` → `apps/web/punktfunk-tizen-<v>.wgt`.
   Sign and install with `design/tizen-probe/package-app.sh` as the template (unzip the `.wgt`, sign
   the directory, `tizen install`). Launch, add `.21` by address, Request access, approve, library
   and covers. The USB keyboard is allowed for this one.
4. **T3 kit to Gitea**: `git am patches/monorepo/t3-console-kit/*.patch` on `main`, push as
   `tizen/t3-console-platform`, PR, merge. Gates it passed here: `cargo test -p pf-console-ui
   --no-default-features` (396/396; this container has no SDL3 for the desktop feature's link),
   clippy `-D warnings` with default features, fmt, `check-writing.sh`.
   Then in client-web on top of #43: `patches/client-web/after-repin.patch` (the three pins to the
   merged rev, the one-line platform pick in `host.rs`), push to `tizen/t3-remote`.
5. **T3 gate** (monitor, remote only): the flow in plan §7 T3.
6. **T4** per plan §8 against `.21` and `.173`; then correct the scope lines on `samsung-tv.md`
   ("What the TV app does and does not do") and the codec gate in `video.ts` if HEVC turns out to
   be software.
7. **T5**: `git am patches/monorepo/t5-docs/*.patch`, push, PR. Tag a client-web release once #42
   and #44 are in: the `.wgt` lands on it. Install it once through Apps2Samsung to prove the
   unsigned-zip route; then, with your yes, the catalog PR to `Apps2Samsung/tizen-community-packages`
   adding `packages/punktfunk__client-web.json` as plan §6 spells it.
8. **Planning repo**: paste `planning/outcomes.md` into the plan's §0 and §7 and the index line into
   `design/README.md`; commit and push.

## Decisions taken while implementing (all within the plan; flag if any is wrong)

- **A 30 s per-request read timeout on the tunnel** (408), beside §4.1's caps: a stream opened and
  left silent would otherwise hold one of the sixteen slots forever and the 60 s idle close would
  never fire.
- **`PeerCertFingerprint(None)` is inserted** on tunnelled requests, as the plain nvhttp listener
  does, rather than leaving the extension absent: it reads as "no client certificate" either way,
  and a handler that extracts it as required cannot 500.
- **Paths are checked raw and percent-decoded**, with dot and empty segments refused; `is_confined`
  is unchanged by D5 (the list only ever constrained pages).
- **The plain router is `None` when the plane is off** (no sniff at all), not a router that answers
  404: a host serving no browsers must not start answering plaintext at all.
- **`HostTarget.tunnel`** is how the client names the route (plan §4.2 left the shape open); the
  bootstrap doubles as the reach probe, and a plane-off host gets its own sentence
  ("Browser streaming is off on this host…").
- **IME field `inputmode`**: `numeric` for a PIN or a port (`digits: true`), `decimal` for an
  address — the plan said `decimal`; a typed hostname (`host.local`) is not enterable with either,
  which is D4 as decided.
- **The quick menu's first row on a TV is Disconnect, keep the game running**, not End stream: a
  Back-then-Enter by reflex must not end what someone is playing.
- **Package id `punktfunk0`**, application id `punktfunk0.punktfunk`, widget id
  `https://github.com/punktfunk/client-web/tizen`. Fixed for the life of the app; change them now
  or never.
- **The kit's `codecs()` for Tizen is `[auto, hevc, h264]`** (like webOS): the console's codec row
  offers what the set decodes, matching the client-side AV1 gate.
- **T4-dependent scope lines** on `samsung-tv.md` are written as "H.264 and HEVC up to 1080p60, no
  AV1/HDR/4K, a measured stream decides each" so the page is honest before T4 and easy to correct
  after.

## What was verified here, and what was not

Verified: the host crate's full suite, clippy, fmt and the two CI scripts; the console kit's suite
with `--no-default-features` (this container has no SDL3; the Ubuntu 26.04 CI image does); the
stream package's type-check and tests (41, 9 new); the web app's type-check against a shim for
`@unom/ui` (the Gitea npm registry was unreachable; `@punktfunk/host` was built from `sdk/` in
the mirror); the zip writer against a stand-in `dist-tizen`; the icon rendered and inspected.

Verified on GitHub Actions (all three PRs green): the real wasm build, the type-check against
the real `@unom/ui`, and on #44 `npm run build:tizen` end to end — `dist-tizen/` with
`config.xml`, `icon.png` and no source maps, then `punktfunk-tizen-0.2.0.wgt` (15 files,
unsigned) uploaded as the `punktfunk-tizen` run artifact.

Not verified: anything on a set, Safari, or a real host.
