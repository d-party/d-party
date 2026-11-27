#!/usr/bin/env bash
# 週次リリース（maintenance.yml の release ジョブ）。規則は .claude/skills/release/SKILL.md の
# 「非対話モード」節。LLM を通さずに判定し、release.yml を dispatch して完了まで見る。
#
# 判定に使うのは commit の件名・本文の型（Conventional Commits）、マージ済み PR のチェック結果、
# main の run の結論だけ。PR や issue の本文は読まない（誰でも書けるので）。
set -euo pipefail

repo="${GITHUB_REPOSITORY:?}"
summary="${GITHUB_STEP_SUMMARY:-/dev/stdout}"
run_url="${GITHUB_SERVER_URL:-https://github.com}/${repo}/actions/runs/${GITHUB_RUN_ID:-}"

log() { printf '%s\n' "$@" >>"$summary"; }

# リリースしない（または失敗した）ことを summary と issue に残す。
# $1 = 理由（1 行。issue のタイトルにもなる）、$2.. = 根拠の箇条
hold() {
  local reason=$1 body existing
  shift
  log "## 週次リリース: 保留" "" "$reason" ""
  [ "$#" -eq 0 ] || printf -- '- %s\n' "$@" >>"$summary"
  body=$(
    printf '%s\n\n' "$reason"
    [ "$#" -eq 0 ] || printf -- '- %s\n' "$@"
    printf '\nrun: %s\n' "$run_url"
  )
  # 同じタイトルの open な issue があればそこへコメントする（重複させない）。
  # 誰でも issue を立てられるので、github-actions が立てたものだけを使う。
  existing=$(gh issue list -R "$repo" --state open --author app/github-actions \
    --search 'in:title 週次リリース保留' --json number --jq '.[0].number // empty')
  if [ -n "$existing" ]; then
    gh issue comment "$existing" -R "$repo" --body "$body"
  else
    gh issue create -R "$repo" --title "週次リリース保留: $reason" --body "$body"
  fi
}

git fetch --tags --quiet origin
latest=$(git tag --list 'v*.*.*' | sort -V | tail -n1)
if [ -z "$latest" ]; then
  hold "リリースタグが見つからない"
  exit 1
fi
range="$latest..origin/main"

# 中身のある commit（merge commit と chore: release を除く）
mapfile -t subjects < <(git log --no-merges --format='%s' "$range" | grep -v '^chore: release v' || true)
if [ "${#subjects[@]}" -eq 0 ]; then
  log "## 週次リリース" "" "$latest 以降に変更が無いので、リリースしない。"
  exit 0
fi

# BREAKING は自動で出さない（major は人が判断する）。
breaking=()
while IFS= read -r s; do breaking+=("破壊的変更の印: $s"); done < <(
  printf '%s\n' "${subjects[@]}" | grep -E '^[A-Za-z]+(\([^)]*\))?!:' || true
)
# `git log | grep -q` は pipefail の下では、grep が先に終わって git が SIGPIPE で落ち、
# 一致しても偽になる。git 自身に探させる。
if [ -n "$(git log --no-merges -E --grep='BREAKING[ -]CHANGE' --format=%h "$range")" ]; then
  breaking+=("commit 本文に BREAKING CHANGE がある")
fi
if [ "${#breaking[@]}" -gt 0 ]; then
  hold "破壊的変更があるので人の判断を待つ" "${breaking[@]}"
  exit 0
fi

# feat があれば minor。同じ期間に Revert "<件名>" で打ち消されたものは数えない
# （squash で付く末尾の " (#123)" は、Revert の側にも打ち消された側にも付きうる）。
reverted=$(printf '%s\n' "${subjects[@]}" | sed -En 's/^Revert "(.*)"( \(#[0-9]+\))?$/\1/p')
feats=$(printf '%s\n' "${subjects[@]}" | grep -E '^feat(\([^)]*\))?:' | grep -vxF -f <(printf '%s\n' "$reverted") || true)
if [ -n "$feats" ]; then bump="minor"; else bump="patch"; fi

# main が緑か。Dependabot のマージは GITHUB_TOKEN で行われ main の CI が起動しないので、
# 前回タグ以降にマージされた PR の head commit のチェックで見る。
since=$(TZ=UTC git log -1 --format=%cd --date=format-local:'%Y-%m-%dT%H:%M:%SZ' "$latest")
# 読めなかったときは緑とみなさない。
if ! merged=$(gh pr list -R "$repo" --state merged --base main --search "merged:>=$since" --limit 200 \
  --json number,statusCheckRollup); then
  hold "マージ済み PR のチェック結果を読めない"
  exit 1
fi
if ! runs=$(gh run list -R "$repo" --branch main --limit 100 \
  --json workflowName,event,status,conclusion,createdAt,url); then
  hold "main の run の結果を読めない"
  exit 1
fi
red=()
while IFS= read -r line; do red+=("$line"); done < <(
  jq -r '.[] | select(any(.statusCheckRollup[]?; ((.conclusion // .state // "") | ascii_upcase) | IN("SUCCESS", "SKIPPED", "NEUTRAL") | not))
         | "#\(.number) のチェックが成功していない"' <<<"$merged"
)
# main で直近に走った run（ワークフローごとの最新）に失敗が残っていないか。fork の PR の run は
# head branch が main でも数えない。このワークフロー自身も数えない（今回の run が走っている）。
# event が dynamic の run（Dependabot の更新ジョブなど）はリポジトリのコードの状態ではない。
while IFS= read -r line; do red+=("$line"); done < <(
  jq -r --arg self "${GITHUB_WORKFLOW:-}" '
    [.[] | select(.status == "completed" and .workflowName != $self
                  and (.event | IN("pull_request", "pull_request_target", "dynamic") | not))]
    | group_by(.workflowName) | map(max_by(.createdAt))
    | .[] | select(.conclusion | IN("failure", "timed_out", "startup_failure"))
    | "\(.workflowName) の最新の run が失敗している: \(.url)"' <<<"$runs"
)
if [ "${#red[@]}" -gt 0 ]; then
  hold "main が緑でない" "${red[@]}"
  exit 0
fi

# 起動。publish は false（公開は人が行う）、release_note は空（GitHub の自動生成）。
# run を探すときの起点。ランナーと GitHub の時計のずれを見込んで少し前にする。
started=$(date -u -d '-30 seconds' +%Y-%m-%dT%H:%M:%SZ)
if ! gh workflow run release.yml -R "$repo" --ref main -f bump_type="$bump" -f publish=false; then
  hold "release.yml を起動できない" "bump: $bump"
  exit 1
fi
log "## 週次リリース" "" "- $latest 以降の commit: ${#subjects[@]} 件 → **$bump**" "- release.yml を dispatch した（publish=false）"

run=""
for _ in $(seq 1 30); do
  run=$(gh run list -R "$repo" --workflow release.yml --event workflow_dispatch --limit 10 \
    --json databaseId,createdAt |
    jq -r --arg s "$started" 'map(select(.createdAt >= $s)) | last | .databaseId // empty')
  [ -z "$run" ] || break
  sleep 5
done
if [ -z "$run" ]; then
  hold "release.yml の run が見つからない" "dispatch: $started"
  exit 1
fi

release_run_url="${GITHUB_SERVER_URL:-https://github.com}/${repo}/actions/runs/$run"
if ! gh run watch "$run" -R "$repo" --exit-status --interval 60 >/dev/null; then
  hold "release.yml の run が失敗した" "$release_run_url"
  exit 1
fi

git fetch --tags --quiet origin
log "- 完了: $(git tag --list 'v*.*.*' | sort -V | tail -n1)（$release_run_url）"
