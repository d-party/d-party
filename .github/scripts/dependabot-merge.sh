#!/usr/bin/env bash
# 週次保守（maintenance.yml の merge ジョブ）。Claude の判定ファイルを読み、機械的に確かめられる
# 条件をすべて満たす Dependabot PR だけをマージし、判定に書かれたコメントを投稿する。
#
# このジョブは書き込みトークンを持つ代わりに、依存のコードを動かさない（pnpm / uv を呼ばない）。
# 判定ファイルは、PR 本文や上流の changelog を読んだ LLM が書いたものなので信用しない。
# PR 番号の候補としてだけ使い、マージしてよいかはここで改めて確かめる。
#
# 判定ファイルの形（.claude/skills/dependabot-review-and-merge/SKILL.md の「非対話モード」）:
#   {"merge": [{"number": 123}], "comments": [{"number": 124, "body": "..."}]}
set -euo pipefail

verdict="${1:?usage: dependabot-merge.sh <verdict.json>}"
repo="${GITHUB_REPOSITORY:?}"
summary="${GITHUB_STEP_SUMMARY:-/dev/stdout}"
# lockfile の衝突は Dependabot が自動で rebase する。その CI を待つのは全 PR で合計 30 分まで。
deadline=$(($(date +%s) + ${MERGE_WAIT_SECONDS:-1800}))

log() { printf '%s\n' "$@" >>"$summary"; }

if ! jq -e 'type == "object"' "$verdict" >/dev/null 2>&1; then
  log "## Dependabot のマージ" "" "判定ファイルを読めなかったので、マージもコメントもしていない。"
  exit 1
fi

# head commit のチェック: green / failed / pending
# shellcheck disable=SC2016 # jq の式（$c · $s は jq の変数）
checks_jq='
  .statusCheckRollup as $c
  | [$c[]? | (.conclusion // .state // "") | ascii_upcase] as $s
  | if ($s | length) == 0 then "pending"
    elif any($s[]; IN("FAILURE", "ERROR", "CANCELLED", "TIMED_OUT", "ACTION_REQUIRED", "STARTUP_FAILURE")) then "failed"
    elif all($s[]; IN("SUCCESS", "SKIPPED", "NEUTRAL")) then "green"
    else "pending" end'

# Dependabot が立てた open な PR か。
is_dependabot_pr() {
  local pr
  pr=$(gh api "repos/$repo/pulls/$1") || return 1
  [ "$(jq -r '.state' <<<"$pr")" = open ] && [ "$(jq -r '.user.login' <<<"$pr")" = 'dependabot[bot]' ]
}

# マージしてよいか。だめなら理由を 1 行出して 1 を返す。
eligible() {
  local n=$1 head=$2 commits
  is_dependabot_pr "$n" || { echo "Dependabot の open な PR ではない"; return 1; }

  commits=$(gh api "repos/$repo/pulls/$n/commits" --paginate --jq '.[] | {sha, login: (.author.login // ""), message: .commit.message}' | jq -s .)
  [ "$(jq -r 'last.sha' <<<"$commits")" = "$head" ] || { echo "確認中に head が変わった"; return 1; }
  # 人や別の bot が足した commit（移行コードなど）は人が見る。
  jq -e 'all(.[]; .login == "dependabot[bot]")' <<<"$commits" >/dev/null ||
    { echo "Dependabot 以外の commit がある"; return 1; }
  # Dependabot は commit 本文に update-type を書く。major と、種別の分からないものは人に回す。
  jq -e '[.[].message | scan("update-type: *version-update:semver-[a-z]+")] as $t
         | ($t | length) > 0 and all($t[]; test("semver-(minor|patch)$"))' <<<"$commits" >/dev/null ||
    { echo "major か、更新の種別が分からない"; return 1; }
  # GITHUB_TOKEN には workflows 権限が無い。
  if gh api "repos/$repo/pulls/$n/files" --paginate --jq '.[].filename' | grep -q '^\.github/workflows/'; then
    echo ".github/workflows/ を変える（手動マージ待ち）"
    return 1
  fi
}

log "## Dependabot のマージ" ""
mapfile -t numbers < <(jq -r '.merge[]? | .number | select(type == "number" and . > 0 and . == floor)' "$verdict")
[ "${#numbers[@]}" -gt 0 ] || log "- 判定でマージ対象になった PR は無い。"

for n in "${numbers[@]}"; do
  while :; do
    if ! state=$(gh pr view "$n" -R "$repo" --json mergeStateStatus,headRefOid,statusCheckRollup); then
      log "- #$n: 見送り（PR を読めない）"
      break
    fi
    head=$(jq -r '.headRefOid' <<<"$state")
    merge_state=$(jq -r '.mergeStateStatus' <<<"$state")
    checks=$(jq -r "$checks_jq" <<<"$state")

    if [ "$checks" = failed ]; then
      log "- #$n: 見送り（head commit のチェックが失敗している）"
      break
    fi
    if [ "$merge_state" = CLEAN ] && [ "$checks" = green ]; then
      if reason=$(eligible "$n" "$head"); then
        if gh pr merge "$n" -R "$repo" --squash --delete-branch --match-head-commit "$head"; then
          log "- #$n: マージした（${head:0:7}）"
        else
          log "- #$n: マージに失敗した（${head:0:7}）"
        fi
      else
        log "- #$n: 見送り（$reason）"
      fi
      break
    fi
    if [ "$(date +%s)" -ge "$deadline" ]; then
      log "- #$n: 翌週に回す（待ち時間の上限。mergeStateStatus=$merge_state, checks=$checks）"
      break
    fi
    sleep 30
  done
done

log "" "## Dependabot PR へのコメント" ""
posted=0
while IFS= read -r item; do
  n=$(jq -r '.number' <<<"$item")
  is_dependabot_pr "$n" || { log "- #$n: 投稿しない（Dependabot の open な PR ではない）"; continue; }
  # 判定ファイルの本文は LLM が書いたもの。メンションとして効かないように @ の後ろへ
  # ゼロ幅スペースを入れる（@dependabot へのコマンドにもならない）。
  body=$(jq -r '.body' <<<"$item")
  marker="<!-- d-party-maintenance:$(printf '%s' "$body" | sha256sum | cut -c1-16) -->"
  # 同じ内容のコメントは重ねない。
  if gh api "repos/$repo/issues/$n/comments" --paginate \
    --jq '.[] | select(.user.login == "github-actions[bot]") | .body' | grep -qF "$marker"; then
    log "- #$n: 同じコメントが既にある"
    continue
  fi
  if printf '%s\n\n%s\n' "$body" "$marker" | gh pr comment "$n" -R "$repo" --body-file -; then
    log "- #$n: コメントした"
    posted=$((posted + 1))
  else
    log "- #$n: コメントに失敗した"
  fi
done < <(jq -c '.comments[]?
  | select((.number | type) == "number" and .number > 0 and .number == (.number | floor) and (.body | type) == "string")
  | {number, body: (.body[:60000] | gsub("@"; "@​"))}' "$verdict")
[ "$posted" -gt 0 ] || log "- 新しく投稿したコメントは無い。"
