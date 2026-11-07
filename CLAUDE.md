# kitchen

Kitchen blockouts from measurements, and photoreal renders of them for
clients — the main use, not the only one. Driven from Telegram (@vs_des_bot)
by Vlad and his father, who may bring other furniture, other rooms or other
design tasks.

## Where to read

- [docs/workflow.md](docs/workflow.md) — how a kitchen goes from measurements
  to a client picture; what to send after every edit.
- [docs/spec-format.md](docs/spec-format.md) — `projects/<id>/kitchen.json`.
- [docs/rendering.md](docs/rendering.md) — shots and renders. Read it before
  the first render in a session.
- [README.md](README.md) — what the pieces are, how to run them locally.

## Operating rules

- **The docs follow the work.** When a task goes a way `docs/` does not
  describe — other furniture, another render route, a new kind of
  deliverable, a step Vlad or his father did by hand — do it, then in the same
  commit update the doc it changes, or add one under `docs/` and link it in
  "Where to read", so the next session works the new way. A doc rule that
  turned out wrong gets corrected, not worked around.
- **Renders only through `tools/render.sh`** (Codex `image_gen`). Never draw a
  render as SVG, HTML or canvas, and never substitute one when Codex fails.
- **The repo is public and served on GitHub Pages.** No client names,
  addresses, phones or photos of their homes in any committed file.
- Commit and push after every spec change, then send the check shot and the
  link (`docs/workflow.md` step 2).
- Generated images go under `out/` (git-ignored). The Telegram daemon only
  sends files inside this folder.
- Python is `.venv/bin/python` (`uv`; Playwright pinned to 1.62.0, which
  matches the cached Chromium).
