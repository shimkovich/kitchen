# Rendering: blockout shot → photoreal picture

The render is made by **Codex's built-in `image_gen`** through
`tools/render.sh`. Claude never draws a render itself — not as SVG, not as
HTML/canvas, not as a "stylised preview". A drawn picture cannot match the
blockout's geometry and is not what the client is shown. If `render.sh` fails,
report the failure; do not substitute a drawing.

## Pipeline

1. **Shot.** `tools/shot.py '<viewer link>' out/<id>/<name>.png` renders the
   link's camera from the local working copy at 1536×1024 with no UI. The
   link comes from the viewer's «📋 Ссылка на ракурс» button; only `?p=` and
   `#cam=` are read from it.
2. **Brief.** `projects/<id>/brief.txt`: materials, finishes, lighting and
   styling in plain English — the `desc` of every material in the spec plus
   whatever the father added. No geometry in it: geometry comes from the shot.
3. **Render.**
   `tools/render.sh out/<id>/<name>.png out/<id>/<name>-render.png projects/<id>/brief.txt [style-ref.png]`
   Takes about a minute; run it with a 10-minute Bash timeout. It prints the
   output path and the seconds taken.
4. **Send** the render to the chat with `[[image: <path>]]`.

## Keeping several angles consistent

Each call invents materials afresh, so two angles of the same kitchen can
come out with different stone veining or a different blue. Once the father
approves one render, pass it as the fourth argument for every further angle:
it is sent as a style reference with instructions to copy finishes only.

## What the script guarantees

- The geometry invariants (camera, cabinet count and sizes, seam lines,
  fixture positions) are in the script's prompt, the same for every render.
  The brief only adds design.
- Output must be under `out/`, inside the bot's folder: the Telegram daemon
  only sends files inside `CWD`.
- It refuses to overwrite an existing file. Version names: `view2-render-b.png`.
- The prompt forbids Codex any git command. `~/.codex/AGENTS.md` tells Codex
  to commit after every edit, and without that line it commits the render —
  2 MB per picture into a public repo.
- Codex is called by absolute path (`/Users/vlad/.local/bin/codex`) because
  the bot's launchd PATH lacks `~/.local/bin`. It runs on the ChatGPT login in
  `~/.codex`; no API key. The full Codex transcript is in `<out>.codex.log`.

## When the render is wrong

- Geometry drifted (a cabinet merged, a door moved): re-run once — the model
  is stochastic. If it repeats, say what is wrong in the brief as a
  constraint ("exactly five base fronts on the back wall").
- Materials wrong: fix the brief, not the script.
- Codex failed or wrote nothing: the script prints the log tail. Usage limits
  on the ChatGPT account are the likely cause of a sudden run of failures.
