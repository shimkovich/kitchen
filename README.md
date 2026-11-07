# kitchen

Grey-box kitchen blockouts built from measurements, viewable on a phone, and
turned into photoreal renders for clients.

- **Viewer** — `index.html` + `viewer.js`, three.js vendored in `vendor/`.
  Served at <https://shimkovich.github.io/kitchen/?p=example>. Builds the
  scene from `projects/<id>/kitchen.json` (format: `docs/spec-format.md`).
  The camera lives in the URL hash, so a view can be shared as a link.
- **Shot** — `tools/shot.py` renders a viewer link headlessly at 1536×1024
  from the working copy.
- **Render** — `tools/render.sh` hands a shot plus a material brief to Codex's
  built-in image generation (`docs/rendering.md`).

The process around them is in `docs/workflow.md`.

## Local setup

```bash
uv venv .venv && uv pip install --python .venv/bin/python playwright==1.62.0
python3 -m http.server 8000   # then open http://127.0.0.1:8000/?p=example
.venv/bin/python tools/shot.py 'p=example' out/example/view.png
tools/render.sh out/example/view.png out/example/view-render.png projects/example/brief.txt
```

Playwright 1.62.0 uses the Chromium build already in
`~/Library/Caches/ms-playwright`; a newer version downloads its own.
