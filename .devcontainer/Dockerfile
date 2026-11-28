# ハイフン付きのタグ（ubuntu-24.04 など）は 2025-10 で更新が止まっている。ubuntuXX.XX の形を使う。
FROM mcr.microsoft.com/devcontainers/base:ubuntu26.04

# Docker Desktop (WSL2) のネットワークが混んでいると、apt が HTTP パイプラインでまとめて
# 受け取った応答が壊れ、"Hash Sum mismatch" で features や playwright（--with-deps）の apt-get が落ちる。
# features より前のこの層で、パイプラインを切り（直列取得になるだけ）、失敗時の再試行を増やす。
RUN printf '%s\n' \
      'Acquire::http::Pipeline-Depth "0";' \
      'Acquire::Retries "5";' \
    > /etc/apt/apt.conf.d/99-devcontainer-network
