#!/bin/bash
# Turn a blockout shot into a photoreal render with Codex's built-in image_gen.
#
#   tools/render.sh <blockout.png> <out.png> <brief.txt> [style-ref.png]
#
# brief.txt holds only the design brief: materials, finishes, lighting, styling.
# A brief line `ref: <path> | <what it shows>` attaches a reference photo of
# one element (a front profile, a stone sample); the path is relative to the
# repo root or absolute. The geometry invariants live here, so every render
# gets the same ones. The optional style-ref is an approved render of the same
# kitchen, passed so a new angle keeps the same materials. See
# docs/rendering.md.
#
# Codex is called by absolute path: the bot runs under launchd, whose PATH has
# no ~/.local/bin. image_gen runs on the ChatGPT login in ~/.codex, so no API
# key is involved.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CODEX=/Users/vlad/.local/bin/codex

if [ $# -lt 3 ] || [ $# -gt 4 ]; then
  echo "usage: $0 <blockout.png> <out.png> <brief.txt> [style-ref.png]" >&2
  exit 2
fi
blockout="$(realpath "$1")"
brief="$(realpath "$3")"
ref="${4:+$(realpath "$4")}"
mkdir -p "$(dirname "$2")"
out="$(realpath "$(dirname "$2")")/$(basename "$2")"

case "$out" in
  "$ROOT"/out/*) ;;
  *) echo "out must be under $ROOT/out/ (the bot can only send files inside its folder)" >&2; exit 2 ;;
esac
if [ -e "$out" ]; then
  echo "already exists, pick a new name: $out" >&2
  exit 2
fi

images=("$blockout")
roles=""
if [ -n "$ref" ]; then
  images+=("$ref")
  roles="Image ${#images[@]} is a style reference only: an approved render of the same kitchen from another angle. Match its materials, colours, finishes and lighting exactly; take nothing about geometry or camera from it."
fi
trim() {
  local s="$1"
  s="${s#"${s%%[![:space:]]*}"}"
  printf '%s' "${s%"${s##*[![:space:]]}"}"
}
while IFS= read -r line; do
  spec="${line#ref:}"
  path="$(trim "${spec%%|*}")"
  what="$(trim "${spec#*|}")"
  [ "$spec" = "${spec#*|}" ] && what="a detail reference"
  case "$path" in /*) ;; *) path="$ROOT/$path" ;; esac
  if [ ! -f "$path" ]; then
    echo "brief references a missing file: $path" >&2
    exit 2
  fi
  images+=("$(realpath "$path")")
  roles="${roles}
Image ${#images[@]} is a reference photo of ${what}. Use it only for how that element looks — profile, texture, colour; take nothing about geometry, layout or camera from it."
done < <(grep -E '^ref:' "$brief" || true)
design="$(grep -v -E '^ref:' "$brief" || true)"

prompt="Use the imagegen skill with the built-in image_gen tool, edit mode (use case: sketch-to-render).
Image 1 is the edit target: a grey-box 3D blockout of a kitchen built from exact measurements.
${roles}
Turn image 1 into a photorealistic interior photograph for a client presentation.
Keep exactly as in image 1: camera position, angle, lens and framing; the room shape; every cabinet's position, width, height and depth; the number of cabinets and the door and drawer divisions shown by the seam lines; the positions of the hob, sink, hood, tall units, windows and doors; the worktop line. Do not add, remove, merge or resize any cabinet or appliance. Flat cabinet fronts in the blockout get the front finish from the brief.

Design brief:
${design}

No people, no text, no labels, no dimension marks, no watermark.
When the image is ready, copy the generated file to ${out} and reply with that path only.
Do not run any git command and do not edit any other file: the caller owns this repository, and the output folder is deliberately untracked."

log="${out%.*}.codex.log"
start=$(date +%s)
printf '%s\n' "$prompt" | "$CODEX" exec \
  --skip-git-repo-check --ephemeral -s workspace-write -C "$ROOT" \
  -c model_reasoning_effort='"low"' \
  --image "${images[@]}" >"$log" 2>&1 || {
  echo "codex failed after $(( $(date +%s) - start ))s; last lines of $log:" >&2
  tail -20 "$log" >&2
  exit 1
}

if [ ! -s "$out" ]; then
  echo "codex finished but did not write $out; last lines of $log:" >&2
  tail -20 "$log" >&2
  exit 1
fi
echo "$out ($(( $(date +%s) - start ))s)"
