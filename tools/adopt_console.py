"""Copy the Freefall Fire Console into firelab/application and hook in the bridge.

Run this again whenever a newer version of the console is dropped next to firelab:
    python -I -X utf8 firelab/tools/adopt_console.py ["path/to/Freefall Fire Console"]

It copies the console's files over application/ (bridge.js, bridge.css and
experiments.js are ours and are left alone) and adds three tags before </body> in
application/index.html. Nothing else in the console is changed.
"""
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT.parent / "Freefall Fire Console"
DST = ROOT / "application"
HOOK = ('<link rel="stylesheet" href="bridge.css">'
        '<script src="experiments.js"></script>'
        '<script type="module" src="bridge.js"></script>\n')


def patch(html, old, new, what):
    if html.count(old) != 1:
        print(f"WARNING: could not apply '{what}' (the console's code changed); skipped")
        return html
    return html.replace(old, new)


def main():
    if not (SRC / "index.html").exists():
        sys.exit(f"No index.html in {SRC}")
    shutil.copytree(SRC, DST, dirs_exist_ok=True)
    page = DST / "index.html"
    html = page.read_text(encoding="utf-8")
    # Two small changes to the copy (never to the user's original):
    # 1. panels are pop-ups now, so the 3D view is centred instead of offset between them
    html = patch(html, 'Cx=matchMedia("(min-width: 1101px)")', "Cx={matches:!1}", "centred view")
    # 2. paint a real NASA Blue Marble image onto the Earth, if tools/get_earth.py fetched one
    if (DST / "earth" / "blue-marble.jpg").exists():
        html = patch(html, "});function yx(", '});{let im=new Image;im.onload=()=>{let c=nd.image;'
                     'c.getContext("2d").drawImage(im,0,0,c.width,c.height);nd.needsUpdate=!0};'
                     'im.src="earth/blue-marble.jpg"}function yx(', "real Earth texture")
        # tip the globe so continents (Africa, Europe, Arabia) face the camera, not the polar ocean
        html = patch(html, "pr.position.set(0,-330,-80);", "pr.position.set(0,-324,-80);pr.rotation.set(1.05,.87,0);", "Earth tilt")
        # a thin atmosphere that is brightest at the horizon and fades into space
        html = patch(html, "pr.add(yx(312,4892927,3.2,2.2))", "pr.add(yx(304,4892927,6.2,1.5))", "thin atmosphere")
        html = patch(html, "float f = pow(1. - abs(dot(vN, vV)), p);",
                     "float f = pow(clamp(abs(dot(vN, vV)) * p, 0., 1.), 1.6);", "atmosphere falloff")
    if "bridge.js" not in html:
        at = html.rfind("</body>")
        if at < 0:
            sys.exit("index.html has no </body>")
        html = html[:at] + HOOK + html[at:]
        page.write_text(html, encoding="utf-8", newline="\n")
    missing = [f for f in ("bridge.js", "bridge.css", "experiments.js") if not (DST / f).exists()]
    print(f"application/ ready from {SRC.name}" + (f"; MISSING {missing}" if missing else ""))


if __name__ == "__main__":
    main()
