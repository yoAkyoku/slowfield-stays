"""
Run scripts/seed_hejing.py (the Hejing Villa child-site content: home,
about, space, experience, pricing, contact, FAQ, articles) against a local or
staging API instead of production, with its production media paths swapped
for the photos seed.mjs uploaded (scripts/showcase/.child-media.json).

    SHOWCASE_API=http://localhost:8000/api/v1 SHOWCASE_EMAIL=… SHOWCASE_PASSWORD=… \
    python scripts/showcase/run-child-seed.py scripts/seed_hejing.py scripts/showcase/.child-media.json
"""
import importlib.util
import json
import os
import sys

seed_path, map_path = sys.argv[1], sys.argv[2]
api = os.environ.get("SHOWCASE_API", "http://localhost:8000/api/v1")
if "slowfield.example" in api:
    sys.exit("refusing to run against production")
os.environ["ADMIN_EMAIL"] = os.environ["SHOWCASE_EMAIL"]
os.environ["ADMIN_PASSWORD"] = os.environ["SHOWCASE_PASSWORD"]

spec = importlib.util.spec_from_file_location("seed_hejing", seed_path)
seed = importlib.util.module_from_spec(spec)
spec.loader.exec_module(seed)
seed.BASE = api

local = json.load(open(map_path, encoding="utf-8"))
# Every role must have its generated image; otherwise the original paths in
# seed_hejing.py would be written to the site as broken images.
missing = [k for k, v in local.items() if k != "sakura" and not v]
if missing:
    sys.exit(f"villa images not generated yet ({', '.join(missing)}): see docs/showcase/AI_IMAGE_PROMPTS.md")
# seed_hejing photo roles → the generated villa images (scripts/showcase/photos.mjs)
roles = {
    "pool_reader": "pool_wide",  # also the home hero, which needs a landscape shot
    "brand_wall": "brand_wall",
    "master_bath": "room_king",
    "ktv_lounge": "living_white",
    "twin_room": "room_twin",
    "villa_collage": "exterior_field",
    "open_living": "living_open",
    "paddy_dining": "dining_field",
}
swap = {seed.M[role]: local[key] for role, key in roles.items()}
# heroes that are not in M
swap.setdefault(seed.HERO["contact"], local["exterior_field"])
swap.setdefault(seed.HERO["faq"], local["corridor"])


def remap(value):
    if isinstance(value, str):
        return swap.get(value, value)
    if isinstance(value, list):
        return [remap(v) for v in value]
    if isinstance(value, dict):
        return {k: remap(v) for k, v in value.items()}
    return value


for name in ("M", "HERO"):
    table = getattr(seed, name)
    for k in table:
        table[k] = remap(table[k])
seed.PAGES = remap(seed.PAGES)
seed.CMS_ENTRIES = remap(seed.CMS_ENTRIES)
# The sakura article borrowed the FAQ hero; it gets its own (AI) photo or waits.
sakura = local.get("sakura")
for entry in seed.CMS_ENTRIES:
    if entry["slug"] == "luozhuang-sakura-trail" and sakura:
        entry["cover_image_url"] = sakura
seed.main()

if not sakura:
    token = seed.login()
    code, rows = seed.req("GET", f"/admin/cms/pages?site=hejing&visibility=all&limit=500", token=token)
    for row in rows if isinstance(rows, list) else []:
        if row.get("slug") == "luozhuang-sakura-trail" and row.get("status") != "draft":
            seed.req("PATCH", f"/admin/cms/pages/{row['id']}/status?site=hejing", token=token, body={"status": "draft"})
            print("  · luozhuang-sakura-trail kept as draft until its photo exists")
