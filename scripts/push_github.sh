#!/bin/bash
# Push a sanitized copy of /app (no .env / secrets) to GitHub. Usage: push_github.sh "commit message"
set -e
MSG="${1:-Update AccessLayer}"
TOKEN=$(grep -E '^GITHUB_TOKEN=' /app/backend/.env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
REPO="github.com/cryptobeast4545/AIWEBSITEEUPGRADER.git"
EXPORT=/tmp/gh_export
mkdir -p $EXPORT
rsync -a --delete --exclude '.git' --exclude 'node_modules' --exclude '.env' --exclude '*.env' --exclude '.emergent' \
  --exclude '__pycache__' --exclude 'memory/test_credentials.md' --exclude 'test_reports' --exclude '.cache' --exclude 'build' \
  /app/ $EXPORT/ --filter='P .git'
cd $EXPORT
[ -f README.md ] || echo "# AIWEBSITEEUPGRADER" > README.md
grep -q '^\.env$' .gitignore 2>/dev/null || printf '\n.env\n*.env\n' >> .gitignore
if [ ! -d .git ]; then
  git init -q && git branch -M main
  git config user.email "bot@accesslayer.io" && git config user.name "AccessLayer Bot"
  git remote add origin "https://x-access-token:${TOKEN}@${REPO}"
  git fetch -q origin main 2>/dev/null && git reset -q --soft origin/main 2>/dev/null || true
fi
git remote set-url origin "https://x-access-token:${TOKEN}@${REPO}"
if grep -rIl --exclude-dir=.git -E "ghp_[A-Za-z0-9]{20,}|sk_test_[A-Za-z0-9]{10,}|ek_[a-f0-9]{20,}" . >/dev/null 2>&1; then
  echo "Secret-like string found, aborting"; exit 1
fi
git add -A
git commit -q -m "$MSG" || echo "Nothing new to commit"
git push -q -u origin main 2>&1 | sed "s/${TOKEN}/***/g"
echo "Pushed: $MSG"
