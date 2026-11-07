"""Render a viewer link to a clean PNG: no UI, no frame, 1536x1024.

    .venv/bin/python tools/shot.py '<viewer link from the chat>' out/<project>/<name>.png
    .venv/bin/python tools/shot.py 'p=example' out/example/default.png

Only the project id (?p=) and the camera (#cam=) are taken from the link; the
page is served from this working copy, not from GitHub Pages, so an edit that
is not deployed yet is already in the shot. The 1536x1024 size and the viewer's
frame overlay are the same 3:2 shape, so the shot matches what was inside the
frame on the phone.
"""

from __future__ import annotations

import argparse
import functools
import http.server
import re
import sys
import threading
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
PROJECT_RE = re.compile(r"^[a-z0-9-]+$")
CAM_RE = re.compile(r"^-?\d+(,-?\d+){5}$")


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args: object) -> None:
        pass


def parse_link(link: str) -> tuple[str, str]:
    parts = urlsplit(link if "://" in link else "http://x/?" + link)
    project = (parse_qs(parts.query).get("p") or ["example"])[0]
    if not PROJECT_RE.match(project):
        sys.exit(f"bad project id in link: {project!r}")
    cam = (parse_qs(parts.fragment).get("cam") or [""])[0]
    if cam and not CAM_RE.match(cam):
        sys.exit(f"bad #cam= in link: {cam!r}")
    if not (ROOT / "projects" / project / "kitchen.json").is_file():
        sys.exit(f"no such project: projects/{project}/kitchen.json")
    return project, cam


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("link", help="viewer URL, or a bare 'p=<id>' for the default view")
    ap.add_argument("out", type=Path)
    ap.add_argument("--dims", action="store_true", help="keep the dimension labels on")
    ap.add_argument("--size", default="1536x1024")
    args = ap.parse_args()

    project, cam = parse_link(args.link)
    width, height = (int(v) for v in args.size.split("x"))
    args.out.parent.mkdir(parents=True, exist_ok=True)

    server = http.server.ThreadingHTTPServer(
        ("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(ROOT))
    )
    threading.Thread(target=server.serve_forever, daemon=True).start()
    port = server.server_address[1]

    fragment = "&".join(f for f in (f"cam={cam}" if cam else "", "dims=1" if args.dims else "") if f)
    query = f"p={project}" + ("" if args.dims else "&shot=1")
    url = f"http://127.0.0.1:{port}/index.html?{query}" + (f"#{fragment}" if fragment else "")

    errors: list[str] = []
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        page = browser.new_page(viewport={"width": width, "height": height})
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(url)
        page.wait_for_function("window.READY === true", timeout=30000)
        if page.evaluate("window.ERROR || ''") or errors:
            sys.exit(f"viewer error: {page.evaluate('window.ERROR || \"\"') or errors}")
        if args.dims:
            page.add_style_tag(content="#buttons, #frame, #toast { display: none !important; }")
        page.wait_for_timeout(500)
        page.screenshot(path=str(args.out))
        browser.close()
    server.shutdown()
    print(args.out)


if __name__ == "__main__":
    main()
