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
   whatever the father added — and `ref:` lines for reference photos (below).
   No geometry in it: geometry comes from the shot.
3. **Render.**
   `tools/render.sh out/<id>/<name>.png out/<id>/<name>-render.png projects/<id>/brief.txt [style-ref.png]`
   Takes about a minute; run it with a 10-minute Bash timeout. It prints the
   output path and the seconds taken.
4. **Send** the render to the chat with `[[image: <path>]]`.

## Reference photos

Photos sent to the chat — a front profile, a stone sample, a handle — are
saved by the Telegram daemon under `out/inbox/` (`SAVE_IMAGES` in the bot's
`bot.conf`), and the prompt lists each one's path. To keep one for a kitchen:

1. Copy it to `out/<id>/refs/<what-it-is>.<ext>` (for example
   `out/k01/refs/front-profile.jpg`). `out/` is git-ignored, which is the
   point: the repo is public and these may be photos of a client's home.
2. Add a line to `projects/<id>/brief.txt`:
   `ref: out/<id>/refs/front-profile.jpg | the cabinet front profile (raised centre panel in a frame)`
   Also describe the element in words in the brief — the photo shows the look,
   the words say where it applies.

`render.sh` attaches every `ref:` line as a reference image with an
instruction to take only that element's look from it.

### Standing references

A reference that holds for every kitchen, not one of them — the front profile
the father builds in — lives in `out/refs/` instead, and its `ref:` line is
copied into each new brief. A `ref:` path is resolved from the repo root, so
the same file serves any project. These are the ones in use:

- `out/refs/front-profile.jpg` — the standard front profile. Brief lines:

      Fronts: classic raised-panel MDF, milled from one sheet — a wide flat
      frame around a raised centre panel, a stepped bevel from the frame down
      into the panel field and a soft chamfer around the raised panel itself.
      Matte white with a faint satin sheen, paint-like, no visible edge
      banding, outer edges softly eased. Drawer fronts carry the same profile
      in a short version.
      ref: out/refs/front-profile.jpg | the cabinet front profile (raised centre panel in a stepped frame, matte white)

`out/` is git-ignored, so a standing reference lives on this machine only: if
it is lost, ask for the photo again.

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
