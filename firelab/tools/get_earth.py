"""Fetch NASA's Blue Marble image for the Earth in the Application section.

Downloads one file (the user approved this on 2026-11-15), then run
tools/adopt_console.py to switch the Earth over.

Image: "Land_ocean_ice_2048.jpg", NASA Goddard Blue Marble (land, ocean and ice),
2048 x 1024, public domain, about 270 KB, fetched from Wikimedia Commons because NASA's
own image server could not be reached from this network.
Saved as application/earth/blue-marble.jpg.

Run:  python tools/get_earth.py
"""
import io
import sys
import urllib.request
from pathlib import Path

from PIL import Image

URL = "https://upload.wikimedia.org/wikipedia/commons/c/cd/Land_ocean_ice_2048.jpg"
OUT = Path(__file__).resolve().parents[1] / "application" / "earth" / "blue-marble.jpg"


def main():
    request = urllib.request.Request(URL, headers={"User-Agent": "FreefallStudentProject/1.0 (local build script)"})
    with urllib.request.urlopen(request, timeout=120) as res:
        data = res.read()
    image = Image.open(io.BytesIO(data))
    if image.width != 2 * image.height:
        sys.exit(f"Unexpected image shape {image.size}; expected a 2:1 world map")
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_bytes(data)
    print(f"Saved {OUT.name}: {image.width} x {image.height}, {len(data) / 1000:.0f} KB")
    print("Now run: python tools/adopt_console.py")


if __name__ == "__main__":
    main()
