# Workflow: from measurements to a client picture

Who: Vlad's father designs kitchens for clients and used to draw them by
hand. He works with the Telegram bot @vs_des_bot in a group with Vlad. The
goal is not a manufacturing drawing — it is a blockout that carries the
dimensions right and a good-looking render to show the client.

## 1. New kitchen

The father sends dimensions (room, walls, window and door positions, what
goes where, module widths) and the material descriptions, as text, a photo of
a sketch, or a voice note. Photos of materials and details (a front profile,
a stone sample) become reference images for the render —
`docs/rendering.md`, "Reference photos".

- Pick a project id with him: a short neutral slug (`k01`, `uglovaya-3200`).
  **Never a client's name, address or phone** — the repo and the viewer are
  public.
- Write `projects/<id>/kitchen.json` (`docs/spec-format.md`) and
  `projects/<id>/brief.txt` (`docs/rendering.md`).
- Anything missing that changes the geometry — ask. Anything that is a
  standard size (plinth, worktop thickness, wall-unit depth) — use the
  default and say which defaults were used.

## 2. Show it

After every change to a spec:

1. Commit and push (GitHub Pages redeploys in about a minute).
2. Shoot the default view with dimensions —
   `tools/shot.py 'p=<id>' out/<id>/check.png --dims` — and send it, so he
   sees the change without opening anything.
3. Send the viewer link `https://shimkovich.github.io/kitchen/?p=<id>`.

In the viewer he can orbit (one finger), pan (two fingers), zoom (pinch),
toggle «📏 Размеры», jump to «⬆️ Сверху», and reset with «↺ Сброс».

## 3. Edits

He writes corrections in plain words ("мойку на 200 правее", "пенал 450").
Apply them to the spec, re-check that the run lengths still fit the wall,
then step 2 again. If an edit makes a run longer than its wall, say so before
applying it.

## 4. Render

He frames the view in the viewer — the bright rectangle is exactly what will
be rendered — and presses «📋 Ссылка на ракурс», then pastes the link in the
chat. Then `docs/rendering.md`: shot from the link, render, send. About a
minute per render. Further angles of the same kitchen use the first approved
render as the style reference.

## 5. For the client

On request: a top view with dimensions (`⬆️ Сверху` link through
`tools/shot.py --dims`) and wall elevations drawn as SVG with dimension lines
from the spec — SVG is right for drawings, never for renders.
