# T1 security review — plane bootstrap and `/mgmt` tunnel

For the monorepo PR body. Five points, as `design/tizen-client-implementation-plan.md` §4.1 asks.
Branch `tizen/t1-mgmt-tunnel`, three commits on `origin/main` @ `31c1f4c`.

## 1. The plaintext listener

One route, `GET /api/v1/webtransport`, served when the management port's first byte is not
`0x16`. It reuses the HTTPS handler unchanged, so the body is byte-for-byte what HTTPS already
serves to anyone with no credential: the plane's port, its certificate hash, its expiry, and the
attestation (the host's long-lived certificate and its signature over the hash). Nothing in it
authorises anything. The plain router has no state, no `require_auth` to bypass, and every other
path answers 404 (`mgmt::bootstrap_app`). It exists only while the plane runs (`browser_plane`);
a host that serves no browsers passes `None`, and `serve_governed` then never peeks, so the
GameStream listener and a plane-off management port behave exactly as before
(`plain_http_on_the_tls_port_reaches_the_plain_router_only_where_offered`).

What an on-path attacker gains over plain HTTP that they did not have over an HTTPS fetch the
page could not verify anyway: nothing. A substituted hash and certificate lets the attacker's
plane be dialled; PAKE pairing over the control stream is what proves the peer, and a paired
page verifies the attestation against the fingerprint it pinned before it dials
(`pf-connect.ts` `verify`). See point 5 for the one gap that already existed.

## 2. Framing

Four bytes of big-endian length, a JSON head, then the body until FIN; the same shape back. No
HTTP parser on either side, so there is no request-line or chunked-encoding to smuggle through.
Caps are enforced before anything is parsed or buffered past them: head ≤ 16 KiB (431), body ≤
1 MiB (413), 16 streams in flight per session (429), 4 tunnels per address (session refused), a
request must arrive whole within 30 s (408), and a tunnel with nothing in flight for 60 s is
closed. Headers: only `authorization`, `content-type`, `accept` and `if-none-match` reach the
router; `host`, `forwarded`, `x-forwarded-*`, cookies and everything else are dropped, and a value
no header can hold (a control character) refuses the request with 400 rather than being passed
on. Methods: GET and POST only. Paths: under `/api/v1/` and never under `/api/v1/local/`, checked
on the raw path and on its percent-decoded form, with dot and empty segments refused rather than
resolved. The position-authenticated route (`/api/v1/local/summary`) is therefore unreachable
through the tunnel at all, not merely refused by the gate.

## 3. `PeerAddr` on every path

Every request the tunnel dispatches carries `PeerAddr(QUIC peer)`, `LocalAddr(plane bind)` and
`PeerCertFingerprint(None)` — the stamps the plain listener gives a request, never a fingerprint a
peer could name. There is one dispatch function (`webtransport::mgmt::dispatch`) and the stamps
are set unconditionally in it before `oneshot`. Pinned from both sides by
`a_tunnelled_request_is_the_lan_peer_it_came_from`: the admin bearer through the tunnel from a LAN
peer is 401, and the very same request straight into the router with no stamp is 200 — which is
the hole the stamp closes. A device token through the tunnel buys exactly the paired-device lane
and not the roster (`a_tunnelled_device_token_reads_the_library_and_no_more`).

## 4. D5: a missing `Origin` admitted past a configured list

`origin_allowed(None, list)` is now `true`. A browser stamps `Origin` on every page's dial and a
page cannot strip it, so the list still refuses every hostile page it refused before. What omits
the header is not a page — a packaged TV app, a native tool — and such a client could send any
origin it chose, so refusing a missing one kept out nobody who wanted in. `is_confined` is
unchanged: `--open` plus a list is still admitted to bind, and that is honest for the same reason
— the list only ever constrained pages. The CORS layer is separate and untouched: a request with
no `Origin` was already served without CORS headers. Pairing remains the credential on the plane.

## 5. First-pairing identity

SPAKE2 binds the client's SPKI and the **plane** certificate hash (`session.rs` `pair`,
`native::pair_ceremony` with `serving.cert_hash`). The identity the page then pins —
`hostFingerprint(host_cert_der)` from the bootstrap response — is not covered by the PAKE. An
on-path attacker during a first PIN pairing who substitutes the attestation's `host_cert_der`
(and the plane hash, to be dialled at all) would have the page pin the attacker's identity while
pairing with the real host's PIN… except that the PAKE then runs against the attacker's plane,
which does not hold the PIN, so the ceremony fails; and if the attacker forwards the ceremony to
the real host, the client's PAKE transcript carries the attacker's plane hash, which the real host
does not match. What survives is narrower: an attacker who can answer the bootstrap can make a
first-time page pin a wrong *long-lived* identity alongside a pairing it never completes. That is
exactly where the HTTPS-without-verification path leaves a browser today, so the plaintext
bootstrap adds nothing new. **Recorded, not closed.** Closing it means putting the identity
fingerprint into the PAKE transcript, a protocol change for every client; proposed as its own
item, not this PR.

## Tests on the PR

`webtransport::mgmt::tests::*` (framing caps, path gate, header allowlist, per-IP cap, a loopback
WebTransport round trip with the in-flight cap), `mgmt::tests::the_plaintext_router_carries_one_route`,
`mgmt::tests::a_tunnelled_request_is_the_lan_peer_it_came_from`,
`mgmt::tests::a_tunnelled_device_token_reads_the_library_and_no_more`,
`gamestream::tls::governed_tests::plain_http_on_the_tls_port_reaches_the_plain_router_only_where_offered`,
`webtransport::tests::origin_gate_admits_only_what_was_configured` (flipped for D5).
Full `punktfunk-host` suite: 968 passed, 0 failed, 6 ignored (pre-existing). `cargo clippy
--all-targets -D warnings` and `cargo fmt --check` clean; `scripts/ci/check-writing.sh` and
`scripts/ci/check-docs-drift.sh` pass.
