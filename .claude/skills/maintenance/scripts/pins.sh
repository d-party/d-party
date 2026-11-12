#!/usr/bin/env bash
# ランタイムと道具の版が「どこに」「いくつで」書かれているかを集める。
# Dependabot が見ていない箇所（node-version · packageManager · helm の values など）を
# 取りこぼさないためのもの。判断は toolchain.md の手順。
#
#   pins.sh            ピンの一覧と、同じものを指すピン同士の食い違い
#   pins.sh latest     上流の最新版とサポート期限（ネットワークと gh が要る）
set -uo pipefail

ROOT=$(git rev-parse --show-toplevel) || exit 2
cd "$ROOT" || exit 2

usage() {
  sed -n '2,7p' "$0" | sed 's/^# \{0,1\}//'
  exit 2
}

GROUPS_SEEN=()
P_GROUP=()
P_WHERE=()
P_VALUE=()
P_LINE=()

# pin <グループ> <場所> <書かれている値> <比較に使う系統>
# 系統が空のものは一覧に出すだけで、食い違いの判定には使わない。
pin() {
  [ -n "$3" ] || return 0
  local g
  for g in "${GROUPS_SEEN[@]:-}"; do [ "$g" = "$1" ] && g=found && break; done
  [ "${g:-}" = found ] || GROUPS_SEEN+=("$1")
  P_GROUP+=("$1")
  P_WHERE+=("$2")
  P_VALUE+=("$3")
  P_LINE+=("${4:-}")
}

major() { grep -oE '[0-9]+' <<<"$1" | head -n1; }
minor() { grep -oE '[0-9]+\.[0-9]+' <<<"$1" | head -n1; }
first() { head -n1; }

# 「repository: <name>」の次に来る「tag:」を拾う（helm の values）。
helm_tag() {
  awk -v name="$1" '
    $1 == "repository:" { hit = ($2 == name) }
    hit && $1 == "tag:" { gsub(/"/, "", $2); print $2; exit }' infra/helm/d-party/values.yaml
}

# devcontainer.json はコメント入りなので jq では読めない。feature の次の "version" を拾う。
devcontainer_feature() {
  awk -v feat="$1" '
    index($0, feat) { hit = 1; next }
    hit && /"version"/ { gsub(/[",]/, "", $2); print $2; exit }
    hit && /\}/ { exit }' .devcontainer/devcontainer.json
}

# ワークフローに出てくる値を「値 ×回数」でまとめる。
# shellcheck disable=SC2016
# ${{ ... }} は式なので値として数えない。ここで展開させたいわけではない。
workflow_values() { # workflow_values <キー>
  grep -rhoE "^ +$1: *[^#]+" .github/workflows | sed -E "s/^ +$1: *//; s/ +\$//" | tr -d "\"'" |
    grep -v '\${{' | sort | uniq -c |
    awk '{ n = $1; $1 = ""; sub(/^ /, ""); printf "%s%s x%s", (NR > 1 ? ", " : ""), $0, n }'
}

collect() {
  local v f

  # ── Python ──
  v=$(grep -oE '^FROM python:[^ ]+' backend/Dockerfile | sed 's/^FROM //' | first)
  pin python "backend/Dockerfile" "$v" "$(minor "$v")"
  v=$(cat backend/.python-version 2>/dev/null)
  pin python "backend/.python-version" "$v" "$(minor "$v")"
  v=$(grep -E '^requires-python' backend/pyproject.toml | cut -d'"' -f2)
  pin python "backend/pyproject.toml requires-python" "$v" "$(minor "$v")"
  v=$(grep -E '^target-version' backend/pyproject.toml | cut -d'"' -f2)
  pin python "backend/pyproject.toml [tool.ruff] target-version" "$v" "$(sed -E 's/^py([0-9])([0-9]+)$/\1.\2/' <<<"$v")"
  v=$(grep -E '^python_version' backend/pyproject.toml | cut -d'"' -f2)
  pin python "backend/pyproject.toml [tool.mypy] python_version" "$v" "$(minor "$v")"
  v=$(devcontainer_feature "features/python:")
  pin python ".devcontainer/devcontainer.json" "$v" "$(minor "$v")"
  v=$(workflow_values python-version)
  pin python ".github/workflows python-version" "$v" "$(minor "$v")"

  # ── uv ──
  v=$(grep -oE 'astral-sh/uv:[^ ]+' backend/Dockerfile | first)
  pin uv "backend/Dockerfile" "$v" "$(minor "$v")"
  pin uv "local (uv --version)" "$(uv --version 2>/dev/null | awk '{ print $2 }')" ""

  # ── Node ──
  v=$(grep -oE '^FROM node:[^ ]+' frontend/Dockerfile | sed 's/^FROM //' | sort -u | paste -sd ' ')
  pin node "frontend/Dockerfile" "$v" "$(major "${v#node:}")"
  v=$(grep -oE 'image: node:[^ ]+' docker-compose.override.yml | sed 's/^image: //' | first)
  pin node "docker-compose.override.yml" "$v" "$(major "${v#node:}")"
  v=$(workflow_values node-version)
  pin node ".github/workflows node-version" "$v" "$(major "$v")"
  v=$(devcontainer_feature "features/node:")
  pin node ".devcontainer/devcontainer.json" "$v" "$(major "$v")"
  for f in frontend/package.json extension/package.json packages/ui/package.json; do
    v=$(jq -r '.devDependencies["@types/node"] // empty' "$f")
    pin node "$f @types/node" "$v" "$(major "$v")"
  done
  pin node "package.json engines.node (min)" "$(jq -r '.engines.node // empty' package.json)" ""

  # ── pnpm ──
  while IFS= read -r f; do
    v=$(jq -r '.packageManager // empty' "$f")
    pin pnpm "$f packageManager" "$v" "${v#pnpm@}"
  done < <(git ls-files 'package.json' '*/package.json')
  v=$(grep -oE 'corepack@[^ ]+' frontend/Dockerfile | first)
  pin pnpm "frontend/Dockerfile (via corepack)" "$v" ""

  # ── PostgreSQL / Redis / nginx ──
  local name
  for name in postgres redis nginx; do
    for f in docker-compose.yml docker-compose.prod.yml; do
      v=$(grep -oE "image: $name:[^ ]+" "$f" | sed 's/^image: //' | first)
      pin "$name" "$f" "$v" "$(minor "${v#*:}" | grep . || major "${v#*:}")"
    done
    v=$(helm_tag "$name")
    pin "$name" "infra/helm/d-party/values.yaml" "$v" "$(minor "$v" | grep . || major "$v")"
    while IFS= read -r line; do
      f=${line%%:*}
      v=$(grep -oE "$name:[0-9][^ \"']*" <<<"$line" | first)
      pin "$name" "$f" "$v" "$(minor "${v#*:}" | grep . || major "${v#*:}")"
    done < <(grep -rHoE "(image|[A-Z_]*IMAGE): *['\"]?$name:[0-9][^ \"']*" .github/workflows | sort -u)
  done

  # ── k6 ──
  v=$(grep -oE 'image: grafana/k6:[^ ]+' docker-compose.loadtest.yml | sed 's/^image: //' | first)
  pin k6 "docker-compose.loadtest.yml" "$v" "$(major "${v#*:}")"
  v=$(devcontainer_feature "features/k6:")
  pin k6 ".devcontainer/devcontainer.json" "$v" "$(major "$v")"

  # ── 浮いている指定（タグが動くので、更新が PR を経ずに入る）──
  while IFS= read -r line; do
    pin floating "${line%%:*}" "$(grep -oE '[^ "]+[:@]latest|"[A-Za-z]+": *"latest"' <<<"$line" | tr -d '"' | paste -sd ' ')" ""
  done < <(grep -rnE ':latest|@latest|"latest"' docker-compose*.yml backend/Dockerfile frontend/Dockerfile \
    .devcontainer/devcontainer.json .github/workflows infra/helm/d-party/values.yaml 2>/dev/null)

  # ── infra に直接書いたイメージ（Dependabot は見ていない）──
  while IFS= read -r line; do
    pin infra "${line%%:*}" "$(sed -E 's/^[^:]+:[0-9]+:image: *//' <<<"$line")" ""
  done < <(grep -rnoE 'image: *[^ ]+' infra --include='*.yaml' --include='*.yml' | grep -v '{{')

  # ── pre-commit ──
  while IFS= read -r line; do
    pin pre-commit ".pre-commit-config.yaml" "$line" ""
  done < <(awk '$1 == "-" && $2 == "repo:" { repo = $3 } $1 == "rev:" { print repo "@" $2 }' .pre-commit-config.yaml)

  # ── devcontainer ──
  v=$(grep -oE '"image": *"[^"]+"' .devcontainer/devcontainer.json | cut -d'"' -f4)
  pin devcontainer ".devcontainer/devcontainer.json image" "$v" ""

  # ── GitHub Actions ──
  pin actions ".github/workflows runs-on" "$(workflow_values runs-on)" ""
  pin actions ".github/workflows matrix runner" "$(workflow_values runner)" ""
  while read -r count action; do
    pin actions "uses x$count" "$action" ""
  done < <(grep -rhoE 'uses: *[^ ]+' .github/workflows | sed -E 's/uses: *//' | sort | uniq -c | sort -k2)
}

cmd_list() {
  collect
  local g i lines mismatch=0
  for g in "${GROUPS_SEEN[@]}"; do
    printf '\n== %s\n' "$g"
    lines=""
    for i in "${!P_GROUP[@]}"; do
      [ "${P_GROUP[$i]}" = "$g" ] || continue
      printf '  %-52s %s\n' "${P_WHERE[$i]}" "${P_VALUE[$i]}"
      [ -n "${P_LINE[$i]}" ] && lines+="${P_LINE[$i]}"$'\n'
    done
    if [ "$(printf '%s' "$lines" | sort -u | grep -c .)" -gt 1 ]; then
      printf '  ⚠ 系統が揃っていない: %s\n' "$(printf '%s' "$lines" | sort -u | paste -sd ' ')"
      mismatch=1
    fi
  done
  echo
  if [ "$mismatch" = 1 ]; then
    echo "食い違いあり（⚠ の行）。揃えるか、分けている理由を確かめる。"
  else
    echo "同じものを指すピンは揃っている。"
  fi
}

# ── latest ───────────────────────────────────────────────────────────────────
eol_cycles() { # eol_cycles <endoflife.date の製品名> <いまの系統>
  printf '\n== %s（いま: %s）\n' "$1" "$2"
  curl -fsS -m 20 "https://endoflife.date/api/$1.json" |
    jq -r --arg cur "$2" '
      .[0:5][]
      | "  \(if .cycle == $cur then "→" else " " end) \(.cycle)\t最新 \(.latest)\tEOL \(if .eol == false then "未定" else .eol end)\(if .lts then "\tLTS \(.lts)" else "" end)"' ||
    echo "  取得できなかった"
}

latest_tag() { # latest_tag <owner/repo>
  gh api "repos/$1/tags?per_page=100" -q '.[].name' 2>/dev/null |
    grep -E '^v?[0-9]+(\.[0-9]+)*$' | sort -V | tail -n1
}

cmd_latest() {
  collect
  local i cur
  line_of() { # グループの最初の系統
    for i in "${!P_GROUP[@]}"; do
      [ "${P_GROUP[$i]}" = "$1" ] && [ -n "${P_LINE[$i]}" ] && printf '%s' "${P_LINE[$i]}" && return
    done
  }
  eol_cycles python "$(line_of python)"
  eol_cycles nodejs "$(line_of node)"
  eol_cycles postgresql "$(line_of postgres)"
  eol_cycles redis "$(line_of redis)"
  eol_cycles nginx "$(line_of nginx)"

  cur=$(line_of pnpm)
  printf '\n== pnpm（いま: %s）\n' "$cur"
  curl -fsS -m 20 https://registry.npmjs.org/pnpm |
    jq -r --arg m "latest-${cur%%.*}" '
      . as $p | ."dist-tags" | to_entries[]
      | select(.key == "latest" or .key == $m)
      | "  \(.key)\t\(.value)\t公開 \($p.time[.value])"' || echo "  取得できなかった"

  printf '\n== uv（Dockerfile: %s · 手元: %s）\n' "$(line_of uv)" "$(uv --version 2>/dev/null | awk '{ print $2 }')"
  printf '  最新 %s\n' "$(gh api repos/astral-sh/uv/releases/latest -q .tag_name 2>/dev/null || echo '?')"

  printf '\n== k6\n  最新 %s\n' "$(gh api repos/grafana/k6/releases/latest -q .tag_name 2>/dev/null || echo '?')"

  printf '\n== GitHub Actions（使っている参照 → 上流の最新タグ）\n'
  local ref repo used newest mark
  while read -r ref; do
    used=${ref##*@}
    repo=$(cut -d/ -f1,2 <<<"${ref%@*}")
    newest=$(latest_tag "$repo")
    mark=" "
    [ -n "$newest" ] && [ "$(major "$used")" != "$(major "$newest")" ] && mark="⚠"
    printf '  %s %-52s 最新 %s\n' "$mark" "$ref" "${newest:-?}"
  done < <(grep -rhoE 'uses: *[^ ]+' .github/workflows | sed -E 's/uses: *//' | grep -v '^\./' | sort -u)
  echo "  ⚠ は major が違う。major タグ（@v7 など）は動くので、同じ major の中の更新は PR を経ずに入る。"

  printf '\n== pre-commit\n'
  for i in "${!P_GROUP[@]}"; do
    [ "${P_GROUP[$i]}" = pre-commit ] || continue
    repo=${P_VALUE[$i]%@*}
    repo=${repo#https://github.com/}
    printf '  %-52s 最新 %s\n' "${P_VALUE[$i]#https://github.com/}" "$(latest_tag "$repo")"
  done
}

case "${1:-list}" in
  list) cmd_list ;;
  latest) cmd_latest ;;
  *) usage ;;
esac
