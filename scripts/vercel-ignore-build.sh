#!/usr/bin/env bash
# Vercel "Ignored Build Step" script.
#
# Exit code convention is the OPPOSITE of what you'd expect from a normal script:
#   exit 0  → build is SKIPPED
#   exit 1  → build PROCEEDS
# (Vercel docs: https://vercel.com/kb/guide/how-do-i-use-the-ignored-build-step-field-on-vercel)
# Do not "fix" this to the usual 0=ok/1=fail convention — it is backwards on purpose,
# per Vercel's own contract for this field.
#
# Skips the build only when every changed path (relative to the previous commit) falls
# under docs/**, .claude/** or *.md. Any other change — including a change alongside a
# docs change — triggers a build.
#
# Usage: vercel-ignore-build.sh [ref]   (defaults to HEAD; pass a historical ref to test)
set -euo pipefail

REF="${1:-HEAD}"

# Vercel clones with --depth=10 by default. If the parent commit isn't available
# (shallow clone boundary, or REF is the repo's first commit), we cannot know what
# changed — build rather than risk skipping a real deploy.
if ! git rev-parse --verify --quiet "${REF}^" > /dev/null; then
  exit 1
fi

if git diff --quiet "${REF}^" "${REF}" -- . ':(exclude)docs/**' ':(exclude).claude/**' ':(exclude)*.md'; then
  exit 0
else
  exit 1
fi
