# kitchen.json — the spec format

One kitchen = one `projects/<id>/kitchen.json`. The viewer (`index.html?p=<id>`)
builds the blockout from it; nothing else holds geometry. All sizes are
millimetres.

## Coordinates

Looking at the room plan with the **back** wall at the top:

- `x` runs along the back wall from the back-left corner, `0 … room.width`.
- `z` runs from the back wall into the room, `0 … room.depth`.
- `y` is height from the floor.

Walls are named `back` (z = 0), `front` (z = depth), `left` (x = 0) and
`right` (x = width). Anything placed against a wall uses a wall-local
position `from`: the distance from that wall's start corner, which is the
**back** end for `left` and `right`, and the **left** end for `back` and
`front`. Cabinet depth always extends into the room.

## Top level

```json
{
  "name": "shown in the viewer title",
  "room": { "width": 3200, "depth": 2600, "height": 2700 },
  "defaults": { ... },
  "materials": { ... },
  "openings": [ ... ],
  "runs": [ ... ],
  "boxes": [ ... ]
}
```

`room` may also carry `wallMaterial`, `floorMaterial` (material keys) and
`walls` (which of the four to draw; default all four).

## defaults

Standard sizes, overridable per module. Built-in values:

| key | field | default | meaning |
|---|---|---|---|
| `base` | `height` | 850 | floor to worktop top |
| | `depth` | 580 | carcass + front |
| | `plinth` | 100 | plinth height |
| | `plinthInset` | 50 | plinth set back from the front |
| | `worktop` | 38 | worktop thickness |
| | `overhang` | 20 | worktop past the fronts |
| `wall` | `bottom` | 1450 | floor to underside of wall cabinets |
| | `height` | 700 | |
| | `depth` | 350 | |
| `tall` | `height` | 2100 | tall units (fridge, oven column, pantry) |
| | `depth` | 600 | |

## materials

`key → { "color": "#rrggbb", "desc": "text for the render brief" }`. `color`
is what the blockout shows; `desc` is the father's material description,
which goes into the render brief. Keys the viewer uses unless a module names
another: `fronts` (base fronts), `wallFronts` (wall cabinets), `worktop`,
`plinth`, `walls`, `floor`, `glass`, `frame`, `door`, `hob`, `sink`, `hood`,
`oven`. Any other key can be referenced by `front` / `material` fields.

## openings

```json
{ "type": "window", "wall": "back", "from": 2000, "width": 1000, "bottom": 900, "height": 1300 }
{ "type": "door",   "wall": "right", "from": 1500, "width": 800, "height": 2100 }
```

## runs

A run is a row of modules along one wall, placed left to right in that wall's
`from` direction with no gaps unless a `gap` module says so.

```json
{ "wall": "back", "level": "base", "from": 0, "front": "fronts", "worktop": "worktop",
  "modules": [ { "w": 600, "fixture": "hob", "drawers": 3 }, { "gap": 600 }, ... ] }
```

- `level`: `base` (floor units with plinth and a worktop) or `wall` (hanging
  units). Default `base`.
- In a base run the worktop is continuous across neighbouring base modules and
  breaks at tall modules, gaps and `"worktop": false` modules.
- Corners: a run on `left`/`right` that meets a `back` run starts at
  `from` = the back run's worktop depth (`base.depth + overhang`, 600 by
  default), so the two do not overlap.

Module fields:

| field | meaning |
|---|---|
| `w` | width |
| `gap` | instead of `w`: empty space of this width (freestanding appliance, nothing) |
| `tall` | base run only: a tall unit (`defaults.tall`), no worktop over it |
| `h`, `d`, `bottom` | overrides of height, depth, wall-unit bottom |
| `doors` | vertical front divisions (default 1) |
| `drawers` | horizontal front divisions (default 0) |
| `front` | material key for this module's front |
| `fixture` | `sink`, `hob`, `oven` (base or tall), `hood` (wall run) |
| `fixtureBottom` | oven: height of its underside |
| `worktop` | `false` to leave this base module without worktop |
| `label` | shown with the dimensions toggle, e.g. `ПММ`, `холодильник` |

A wall-run `hood` module defaults to bottom `wall.bottom + 100`, height 600,
depth 350; `bottom`, `h`, `d` and `material` override.

## boxes

Escape hatch for anything that is not a run: an island, a boxed-in pipe, a
column, a bar counter. World coordinates of the min corner plus size:

```json
{ "x": 1200, "y": 0, "z": 1500, "w": 1200, "h": 900, "d": 800, "material": "fronts", "label": "остров" }
```
