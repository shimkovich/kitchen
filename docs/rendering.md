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

1. Copy it next to the kitchen it belongs to (below).
2. Add a line to `projects/<id>/brief.txt`:
   `ref: projects/<id>/refs/front-profile.jpg | the cabinet front profile (raised centre panel in a frame)`
   Also describe the element in words in the brief — the photo shows the look,
   the words say where it applies.

`render.sh` attaches every `ref:` line as a reference image with an
instruction to take only that element's look from it. A `ref:` path is
resolved from the repo root.

### Where a reference lives

Every reference belongs to one kitchen — a front profile chosen for this
client is not the next client's. Which folder depends on whether the photo
can be published, because the repo is public:

- A catalogue or sample photo — a front profile, a stone sample, a handle —
  goes in `projects/<id>/refs/` and is committed, so the brief and the
  pictures it points at travel together.
- A photo of a client's home stays in `out/<id>/refs/`, which is git-ignored.

If no kitchen exists yet when a reference arrives, ask which kitchen it is
for; if the father has not named it yet, start the project under a
provisional slug and rename later — a rename is `git mv` plus the `ref:`
lines in that one brief.

## Keeping several angles consistent

Each call invents materials afresh, so two angles of the same kitchen can
come out with different stone veining or a different blue. Once the father
approves one render — "отлично", "то что нужно", "оставляем" — record it in
the brief:

    style: out/<id>/<name>-render.png

`render.sh` then sends it with every further angle as a style reference, with
instructions to copy finishes only and nothing about geometry or camera. The
fourth argument does the same thing for one call and wins over the line.

The approved render sits under `out/`, which is git-ignored, so the `style:`
line is the only record of which one it was; if the file is gone the script
says so rather than quietly rendering without it. When the father changes a
colour or a material, the approved render is out of date — drop or replace
the line before rendering, or the old colour comes back.

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
