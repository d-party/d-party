# syntax=docker/dockerfile:1

# Named stage so COPY --from refers to an alias (hadolint DL3022).
FROM ghcr.io/astral-sh/uv:0.13 AS uv

FROM python:3.15-slim-bookworm

COPY --from=uv /uv /uvx /bin/

# The venv lives outside the app dir so compose's source bind mount does not hide it.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DEBCONF_NOWARNINGS=yes \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/opt/venv \
    PATH="/opt/venv/bin:$PATH"

WORKDIR /usr/src/app

COPY pyproject.toml uv.lock ./
# autobahn は NVX 拡張のビルドに失敗すると pure-Python へ戻らないので、明示的に切る
# （NVX は UTF-8 検証の高速化だけ）。
RUN --mount=type=cache,target=/root/.cache/uv \
    AUTOBAHN_USE_NVX=0 uv sync --frozen --no-dev --no-install-project

# The base image's pip / setuptools are unused (uv installs everything); drop them so
# their CVEs are not shipped. /opt/venv/bin is first on PATH, hence the absolute path.
RUN /usr/local/bin/python -m pip uninstall --yes setuptools pip

COPY . .

# uid 1000 は compose でバインドマウントする ./backend の所有者に合わせている。
RUN groupadd --system --gid 1000 app \
    && useradd --system --uid 1000 --gid app --no-create-home app
USER 1000:1000

EXPOSE 8000

CMD ["sh", "entrypoint.sh"]
