#!/bin/bash
echo "🚀 Deploying Clarity..."
git add .

# Secret-Check: Commit abbrechen, wenn im Diff Secrets oder .env-Dateien landen würden
PATTERN='discord(app)?\.com/api/webhooks/[0-9]+/|-----BEGIN [A-Z ]*PRIVATE KEY|ghp_[A-Za-z0-9]{30,}|sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|[A-Z_]*(TOKEN|SECRET|PASS(WORD)?|API_?KEY|WEBHOOK)[A-Z_]*["'"'"' ]*[:=] *["'"'"']?[A-Za-z0-9_+/=.-]{16,}|[a-f0-9]{40,}'
LEAKS=""
while IFS= read -r f; do
  [ -z "$f" ] && continue
  if [[ "$f" =~ (^|/)\.env$ ]]; then LEAKS+="  $f (.env-Datei)"$'\n'; continue; fi
  if git diff --cached -U0 -- "$f" | grep -E '^\+' | grep -v '^+++' | grep -vE '\$\{|process\.env|change_me|<[a-z-]+>' | grep -qE "$PATTERN"; then
    LEAKS+="  $f"$'\n'
  fi
done <<< "$(git diff --cached --name-only --diff-filter=ACMR)"
if [ -n "$LEAKS" ]; then
  echo "❌ Abbruch: mögliches Secret im Commit gefunden in:"
  printf '%s' "$LEAKS"
  echo "Secrets gehören in die .env (Zugriff über \${VAR}). Nichts wurde committet oder gepusht."
  git reset -q
  exit 1
fi

git commit -m "${1:-update}"
git push
docker compose up -d --build
docker compose restart clarity-backend
echo "✅ Done"
