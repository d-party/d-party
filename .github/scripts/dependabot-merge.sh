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
#
# pipefail の下で `cmd | grep -q` は使わない。grep -q が先に終わると cmd が SIGPIPE で
# 落ち、パイプ全体が失敗扱いになって、一致したのに if が偽になる。出力は変数に受けてから見る。
set -euo pipefail

verdict="${1:?usage: dependabot-merge.sh <verdict.json>}"
repo="${GITHUB_REPOSITORY:?}"
summary="${GITHUB_STEP_SUMMARY:-/dev/stdout}"
# lockfile の衝突は Dependabot が自動で rebase する。その CI を待つのは全 PR で合計 30 分まで。
deadline=$(($(date +%s) + ${MERGE_WAIT_SECONDS:-1800}))
poll="${MERGE_POLL_SECONDS:-30}"

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

# Dependabot が同じリポジトリのブランチから立てた open な PR か。
is_dependabot_pr() {
  local pr
  pr=$(gh api "repos/$repo/pulls/$1") || return 1
  jq -e '.state == "open" and .user.login == "dependabot[bot]"
         and .head.repo.full_name == .base.repo.full_name' <<<"$pr" >/dev/null
}

# マージしてよいか。だめなら理由を 1 行出して 1 を返す。
eligible() {
  local n=$1 head=$2 commits files
  is_dependabot_pr "$n" || { echo "Dependabot の open な PR ではない"; return 1; }

  commits=$(gh api "repos/$repo/pulls/$n/commits" --paginate \
    --jq '.[] | {sha, login: (.author.login // ""), committer: (.committer.login // ""),
                 verified: (.commit.verification.verified // false), message: .commit.message}' |
    jq -s .) || { echo "commit を読めない"; return 1; }
  [ "$(jq -r 'last.sha' <<<"$commits")" = "$head" ] || { echo "確認中に head が変わった"; return 1; }
  # author は commit のメールアドレスから決まるので、push できる人なら名乗れる。Dependabot の
  # commit は GitHub（web-flow）が署名するので、検証済みの署名もあわせて求める。
  # 人や別の bot が足した commit（移行コードなど）は人が見る。
  jq -e 'all(.[]; .login == "dependabot[bot]" and .committer == "web-flow" and .verified)' \
    <<<"$commits" >/dev/null || { echo "Dependabot が署名した commit だけではない"; return 1; }
  # Dependabot は commit 本文に依存ごとの update-type を書く。major と、種別の書かれていない
  # 依存が 1 つでもあれば人に回す。
  jq -e '[.[].message | scan("dependency-name:")] as $names
         | [.[].message | scan("update-type: *version-update:semver-[a-z]+")] as $t
         | ($t | length) > 0 and ($t | length) == ($names | length)
           and all($t[]; test("semver-(minor|patch)$"))' <<<"$commits" >/dev/null ||
    { echo "major か、更新の種別が分からない依存がある"; return 1; }
  # GITHUB_TOKEN には workflows 権限が無い。
  files=$(gh api "repos/$repo/pulls/$n/files" --paginate --jq '.[].filename') ||
    { echo "変更ファイルを読めない"; return 1; }
  if [[ $'\n'"$files" == *$'\n.github/workflows/'* ]]; then
    echo ".github/workflows/ を変える（手動マージ待ち）"
    return 1
  fi
}

log "## Dependabot のマージ" ""
# 重複と、番号でない値は落とす（1 つ壊れた値があっても残りは読む）。
mapfile -t numbers < <(jq -r '
  [.merge[]? | objects | .number | select(type == "number" and . > 0 and . == floor)]
  | reduce .[] as $n ([]; if index([$n]) then . else . + [$n] end) | .[]' "$verdict")
[ "${#numbers[@]}" -gt 0 ] || log "- 判定でマージ対象になった PR は無い。"

failed=0
for n in "${numbers[@]}"; do
  # 待つ前に確かめる。閉じた PR や人の PR を CLEAN になるまで待って、時間を使い切らない。
  if ! is_dependabot_pr "$n"; then
    log "- #$n: 見送り（Dependabot の open な PR ではない）"
    continue
  fi
  while :; do
    if ! state=$(gh pr view "$n" -R "$repo" --json state,mergeStateStatus,headRefOid,statusCheckRollup); then
      log "- #$n: 見送り（PR を読めない）"
      break
    fi
    if [ "$(jq -r '.state' <<<"$state")" != OPEN ]; then
      log "- #$n: 見送り（open でなくなった）"
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
      if ! reason=$(eligible "$n" "$head"); then
        log "- #$n: 見送り（$reason）"
        break
      fi
      if gh pr merge "$n" -R "$repo" --squash --delete-branch --match-head-commit "$head"; then
        log "- #$n: マージした（${head:0:7}）"
        break
      fi
      # 直前のマージの直後は、古い CLEAN が返ったり base が変わったと断られたりする。
      # Dependabot の rebase を待ってやり直す。
      if [ "$(date +%s)" -ge "$deadline" ]; then
        log "- #$n: マージに失敗した（${head:0:7}）"
        failed=$((failed + 1))
        break
      fi
    elif [ "$(date +%s)" -ge "$deadline" ]; then
      log "- #$n: 翌週に回す（待ち時間の上限。mergeStateStatus=$merge_state, checks=$checks）"
      break
    fi
    sleep "$poll"
  done
done

log "" "## Dependabot PR へのコメント" ""
posted=0
while IFS= read -r item; do
  n=$(jq -r '.number' <<<"$item")
  is_dependabot_pr "$n" || { log "- #$n: 投稿しない（Dependabot の open な PR ではない）"; continue; }
  body=$(jq -r '.body' <<<"$item")
  marker="<!-- d-party-maintenance:$(printf '%s' "$body" | sha256sum | cut -c1-16) -->"
  # 同じ内容のコメントは重ねない。
  if ! existing=$(gh api "repos/$repo/issues/$n/comments" --paginate \
    --jq '.[] | select(.user.login == "github-actions[bot]") | .body'); then
    log "- #$n: 投稿しない（既存のコメントを読めない）"
    continue
  fi
  if [[ "$existing" == *"$marker"* ]]; then
    log "- #$n: 同じコメントが既にある"
    continue
  fi
  if printf '%s\n\n%s\n' "$body" "$marker" | gh pr comment "$n" -R "$repo" --body-file -; then
    log "- #$n: コメントした"
    posted=$((posted + 1))
  else
    log "- #$n: コメントに失敗した"
  fi
# 判定ファイルの本文は LLM が書いたもの。メンションとして効かないように @ の後ろへ
# ゼロ幅スペースを入れる（@dependabot へのコマンドにもならない）。文字参照（&#64; など）で
# @ を書かれないように & も文字参照にする。GitHub の上限（65536 文字）に収まるよう最後に切る。
done < <(jq -c '.comments[]? | objects
  | select((.number | type) == "number" and .number > 0 and .number == (.number | floor) and (.body | type) == "string")
  | {number, body: (.body | gsub("&"; "&amp;") | gsub("@"; "@​") | .[:60000])}' "$verdict")
[ "$posted" -gt 0 ] || log "- 新しく投稿したコメントは無い。"

if [ "$failed" -gt 0 ]; then
  log "" "マージに失敗した PR が $failed 件ある。"
  exit 1
fi
