# Tizen SDK 10.0 web-cli (tizen, sdb) in an amd64 container: Samsung ships sdb for Intel only.
# Build: docker build --platform linux/amd64 -t punktfunk-tizen-cli:10.0 .
FROM --platform=linux/amd64 ubuntu:24.04
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl zip unzip python3 libglib2.0-0 libsecret-1-0 gnome-keyring dbus-x11 \
    && rm -rf /var/lib/apt/lists/*
RUN useradd -m tizen
USER tizen
WORKDIR /home/tizen
RUN curl -fsSLo /tmp/sdk.bin \
      https://download.tizen.org/sdk/Installer/tizen-sdk_10.0/web-cli_Tizen_SDK_10.0_ubuntu-64.bin \
    && bash /tmp/sdk.bin --accept-license /home/tizen/tizen-studio \
    && rm /tmp/sdk.bin
ENV PATH=/home/tizen/tizen-studio/tools:/home/tizen/tizen-studio/tools/ide/bin:$PATH
# Samsung Certificate Extension (≥ 2.0.74 issues certificates since 2025-09) carries the Samsung CA
# files a TV signing profile chains to.
RUN ~/tizen-studio/package-manager/package-manager-cli.bin install --accept-license \
      cert-add-on,TV-SAMSUNG-Extension-Tools
