#!/usr/bin/env bash
# Sign the staged package for one Samsung TV, and with `install` push and launch it there.
#
#   tools/sign.sh                          sign build/app → build/punktfunk-tizen-<v>-signed.wgt
#   tools/sign.sh path/to/punktfunk-tizen-<v>.wgt
#                                          unzip that release asset to build/app first, then sign
#   TV=<tv address> tools/sign.sh install  ... then sdb connect, install, launch
#
# A set from 2023 on installs only a package signed with a Samsung distributor certificate that
# lists its DUID, so this runs per TV. Signing happens in the punktfunk-tizen-cli image
# (toolchain/Dockerfile): Samsung ships sdb for Intel only, so on an Apple Silicon Mac the CLI
# runs in an amd64 container, kept alive so sdb keeps its connection.
#
# Certificates: samsung-tv-cert --duid <DUID from `sdb shell 0 getduid`> --profile <PROFILE>
# makes ~/tizen-studio-data/SamsungCertificate/<PROFILE>/{author,distributor}.p12. Three traps,
# all handled below: the container has no keyring, so `tizen security-profiles add` cannot store
# the password and signing fails with "Invaild password" — the profile is written with it inline;
# samsung-tv-cert's node-forge .p12 hides its key from Java, so the CLI signs with an openssl
# re-export, <k>-jdk.p12 (`pkcs12 -export -inkey <k>.pri -in <leaf of k.crt> -certfile <CA>`);
# and a password that looks like base64 is taken for an encrypted one, so jdk-password must
# hold one with a character outside base64.
#
# Env: PROFILE (signing profile, default punktfunk), TV (the set's address, for install),
# IMAGE (default punktfunk-tizen-cli:10.0), APP_ID (default punktfunk0.punktfunk).
set -euo pipefail
here=$(cd "$(dirname "$0")/.." && pwd)
PROFILE=${PROFILE:-punktfunk}
IMAGE=${IMAGE:-punktfunk-tizen-cli:10.0}
APP_ID=${APP_ID:-punktfunk0.punktfunk}
stage=$here/build/app

case "${1:-}" in
  *.wgt)
    rm -rf "$stage" && mkdir -p "$stage"
    unzip -q "$1" -d "$stage"
    shift
    ;;
esac
[ -f "$stage/config.xml" ] || { echo "no staged package at $stage — run node tools/build.mjs first, or pass a .wgt"; exit 1; }
version=$(tr '\n' ' ' < "$stage/config.xml" | sed -n 's/.*<widget[^>]*[[:space:]]version="\([^"]*\)".*/\1/p')
version=${version:-0.0.0}

certs=$HOME/tizen-studio-data/SamsungCertificate/$PROFILE
pwfile=$certs/jdk-password
[ -f "$certs/distributor-jdk.p12" ] && [ -f "$pwfile" ] || {
  echo "no Samsung certificate at $certs — run samsung-tv-cert --duid <DUID> --profile $PROFILE first"; exit 1; }

if ! docker ps --format '{{.Names}}' | grep -qx pf-tizen; then
  docker rm -f pf-tizen >/dev/null 2>&1 || true
  docker run -d --name pf-tizen --platform linux/amd64 \
    -v "$here/build:/build" -v "$HOME/tizen-studio-data:/host-data:ro" -v "$pwfile:/host-pw:ro" \
    "$IMAGE" sleep infinity >/dev/null
fi
x() { docker exec -e PROFILE="$PROFILE" -e TV="${TV:-}" -e APP_ID="$APP_ID" -e VERSION="$version" pf-tizen bash -lc "$1"; }

x '
set -e
pw=$(cat /host-pw) c=/host-data/SamsungCertificate/$PROFILE ca=/host-data/samsung-ca
mkdir -p ~/tizen-studio-data/profile
cat > ~/tizen-studio-data/profile/profiles.xml <<X
<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<profiles active="$PROFILE" version="3.1">
<profile name="$PROFILE">
<profileitem ca="$ca/vd_tizen_dev_author_ca.cer" distributor="0" key="$c/author-jdk.p12" password="$pw" rootca=""/>
<profileitem ca="$ca/vd_tizen_dev_public2.crt" distributor="1" key="$c/distributor-jdk.p12" password="$pw" rootca=""/>
<profileitem ca="" distributor="2" key="" password="" rootca=""/>
</profile>
</profiles>
X
tizen cli-config "profiles.path=$HOME/tizen-studio-data/profile/profiles.xml" >/dev/null
rm -rf /tmp/app /tmp/out && cp -r /build/app /tmp/app
tizen package -t wgt -s "$PROFILE" -o /tmp/out -- /tmp/app | tail -1
cp /tmp/out/*.wgt "/build/punktfunk-tizen-$VERSION-signed.wgt"'
echo "signed: $here/build/punktfunk-tizen-$version-signed.wgt"

[ "${1:-}" = install ] || exit 0
: "${TV:?set TV=<tv address>}"
x 'set -e
sdb connect "$TV:26101"
dev=$(sdb devices | awk -v t="$TV:26101" "\$1==t {print \$3}")
[ -n "$dev" ] || { sdb devices; echo "TV not attached"; exit 1; }
tizen install -n "punktfunk-tizen-$VERSION-signed.wgt" -t "$dev" -- /build
tizen run -p "$APP_ID" -t "$dev"'
