# Based off of https://platform.openai.com/docs/guides/tools-computer-use?lang=python&integration_cua=playwright#setting-up-your-environment

FROM ubuntu:22.04
ENV DEBIAN_FRONTEND=noninteractive

# 1) Install Xfce, x11vnc, Xvfb, xdotool, etc., but remove any screen lockers or power managers
RUN apt-get update && apt-get install -y \
    xfce4 \
    xfce4-goodies \
    x11vnc \
    xvfb \
    xdotool \
    imagemagick \
    x11-apps \
    sudo \
    software-properties-common \
    imagemagick \
    curl \
    python3-numpy \
    && apt-get remove -y light-locker xfce4-screensaver xfce4-power-manager || true \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# 2) Add the mozillateam PPA and install Firefox ESR
RUN add-apt-repository ppa:mozillateam/ppa \
    && apt-get update \
    && apt-get install -y --no-install-recommends firefox-esr \
    && update-alternatives --set x-www-browser /usr/bin/firefox-esr \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# 3) Install noVNC
RUN mkdir -p /opt/novnc/utils/websockify && \
    curl -L https://github.com/novnc/noVNC/archive/refs/tags/v1.5.0.tar.gz | tar xz --strip-components=1 -C /opt/novnc && \
    curl -L https://github.com/novnc/websockify/archive/refs/heads/master.tar.gz | tar xz --strip-components=1 -C /opt/novnc/utils/websockify && \
    ln -s /opt/novnc/utils/novnc_proxy /usr/local/bin/novnc_proxy

# 4) Create non-root user
RUN useradd -ms /bin/bash myuser \
    && echo "myuser ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers
USER myuser
WORKDIR /home/myuser

# 5) Set x11vnc password ("secret")
RUN x11vnc -storepasswd secret /home/myuser/.vncpass

# 6) Expose VNC and noVNC ports
EXPOSE 5900 6080

CMD ["/bin/sh", "-c", "\
    Xvfb :99 -screen 0 1280x800x24 >/dev/null 2>&1 & \
    x11vnc -display :99 -forever -shared -rfbauth /home/myuser/.vncpass -listen 0.0.0.0 -rfbport 5900 >/dev/null 2>&1 & \
    export DISPLAY=:99 && \
    startxfce4 >/dev/null 2>&1 & \
    sleep 2 && \
    cd /opt/novnc && \
    ./utils/novnc_proxy --vnc localhost:5900 --listen 0.0.0.0:6080 --web /opt/novnc"]