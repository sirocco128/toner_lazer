#!/usr/bin/env python3
"""Pull the public catalog from smartgiftthailand.com into SmartGift MySQL.

Usage:
  python scripts/sync-smartgift-website.py
  python scripts/sync-smartgift-website.py --dry-run
"""

from __future__ import annotations

import argparse
import json
import os
import re
import ssl
import sys
import urllib.request
from html.parser import HTMLParser
from pathlib import Path
from typing import Any
from urllib.parse import urljoin

ROOT = Path(__file__).resolve().parents[1]
SITE = "https://smartgiftthailand.com"
SEARCH_PATH = "/premium-gifts/search"
UA = "TerabisCatalogSync/1.0 (+https://smartgiftthailand.com)"

WEBSITE_CATEGORIES = [
    ("gift-set", "ชุดของขวัญ", "Gift sets", "ชุดของขวัญองค์กรพร้อมสกรีนโลโก้"),
    ("drinkware", "แก้วและกระบอกน้ำ", "Drinkware", "แก้ว ทัมเบลอร์ และกระบอกน้ำ"),
    ("technology", "สินค้าไอที", "Technology", "พาวเวอร์แบงก์ ลำโพง และแกเจ็ต"),
    ("wellness", "สุขภาพและเวลเนส", "Wellness", "พัดลม เครื่องนวด และของใช้ส่วนตัว"),
    ("office", "สมุดและออฟฟิศ", "Office", "สมุด ปากกา และของใช้ออฟฟิศ"),
    ("bag", "กระเป๋าและถุงผ้า", "Bags", "กระเป๋าและถุงผ้าสกรีนโลโก้"),
    ("eco", "สินค้ารักษ์โลก", "Eco", "วัสดุธรรมชาติและรีไซเคิล"),
    ("custom", "สั่งผลิตพิเศษ", "Custom", "งานสั่งผลิตตามโจทย์แคมเปญ"),
]


def env_file_value(key: str, default: str = "") -> str:
    path = ROOT / ".env.local"
    if not path.exists():
        return os.environ.get(key, default)
    for line in path.read_text(encoding="utf-8").splitlines():
        raw = line.strip()
        if not raw or raw.startswith("#") or "=" not in raw:
            continue
        name, value = raw.split("=", 1)
        if name.strip() == key:
            return value.strip().strip('"').strip("'")
    return os.environ.get(key, default)


class ScriptSrcParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.srcs: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag != "script":
            return
        src = dict(attrs).get("src")
        if src and "/_next/static/chunks/" in src:
            self.srcs.append(src)


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    ctx = ssl.create_default_context()
    with urllib.request.urlopen(req, context=ctx, timeout=60) as res:
        return res.read()


def decode_js(raw: bytes) -> str:
    return raw.decode("utf-8", errors="replace")


def parse_json_objects(text: str) -> dict[str, dict[str, Any]]:
    cleaned = text.replace("\\'", "'")
    decoder = json.JSONDecoder()
    found: dict[str, dict[str, Any]] = {}
    idx = 0
    while True:
        start = cleaned.find('{"slug":', idx)
        if start < 0:
            break
        try:
            obj, end = decoder.raw_decode(cleaned[start:])
        except json.JSONDecodeError:
            idx = start + 8
            continue
        idx = start + max(end, 8)
        if isinstance(obj, dict):
            keep_product(found, obj)
    return found


def parse_featured_array(text: str) -> dict[str, dict[str, Any]]:
    start = text.find('[{slug:"')
    found: dict[str, dict[str, Any]] = {}
    if start < 0:
        return found
    pos = start
    last = start
    while True:
        i = text.find('mode:"quote"}', pos)
        if i < 0 or i > start + 40000:
            break
        last = i
        pos = i + 1
    if last == start:
        return found
    arr = text[start : last + len('mode:"quote"}')] + "]"
    js = re.sub(r"([{\[,])([A-Za-z]+):", r'\1"\2":', arr)
    try:
        rows = json.loads(js)
    except json.JSONDecodeError:
        return found
    if isinstance(rows, list):
        for obj in rows:
            if isinstance(obj, dict):
                keep_product(found, obj)
    return found


def keep_product(found: dict[str, dict[str, Any]], obj: dict[str, Any]) -> None:
    code = str(obj.get("code") or "").strip().upper()
    name = str(obj.get("name") or "").strip()
    if not code or not name:
        return
    incoming_tiers = obj.get("tiers") or []
    prev = found.get(code)
    if prev is None:
        found[code] = obj
        return
    prev_tiers = prev.get("tiers") or []
    if incoming_tiers and not prev_tiers:
        found[code] = obj
    elif incoming_tiers and len(incoming_tiers) >= len(prev_tiers):
        merged = {**prev, **obj, "tiers": incoming_tiers}
        if not str(obj.get("name") or "").strip():
            merged["name"] = prev.get("name")
        found[code] = merged
    else:
        if not prev_tiers and incoming_tiers:
            found[code] = obj


def extract_from_chunks(html: str) -> dict[str, dict[str, Any]]:
    parser = ScriptSrcParser()
    parser.feed(html)
    found: dict[str, dict[str, Any]] = {}
    for src in parser.srcs:
        url = urljoin(SITE, src)
        raw = fetch(url)
        if len(raw) < 20_000:
            continue
        text = decode_js(raw)
        chunk_products = parse_json_objects(text)
        featured = parse_featured_array(text)
        for code, row in {**chunk_products, **featured}.items():
            keep_product(found, row)
        # featured overlay after json so priced copies win
        for code, row in featured.items():
            keep_product(found, row)
    return found


def absolute_image(path: str | None) -> str | None:
    value = (path or "").strip()
    if not value:
        return None
    if value.startswith("http://") or value.startswith("https://"):
        return value
    if value.startswith("/"):
        return SITE + value
    return SITE + "/" + value.lstrip("/")


def connect():
    import pymysql

    return pymysql.connect(
        host=env_file_value("SMARTGIFT_MYSQL_HOST", "127.0.0.1"),
        port=int(env_file_value("SMARTGIFT_MYSQL_PORT", "3307") or "3307"),
        user=env_file_value("SMARTGIFT_MYSQL_USER", "biz"),
        password=env_file_value("SMARTGIFT_MYSQL_PASSWORD", "biz_secret"),
        database=env_file_value("SMARTGIFT_MYSQL_DATABASE", "smartgift"),
        charset="utf8mb4",
        autocommit=False,
    )


def ensure_columns(cur) -> None:
    cur.execute("SHOW COLUMNS FROM sg_offer")
    cols = {row[0] for row in cur.fetchall()}
    statements = []
    if "image_url" not in cols:
        statements.append(
            "ALTER TABLE sg_offer ADD COLUMN image_url VARCHAR(512) NULL AFTER unboxing_experience"
        )
    if "source_slug" not in cols:
        statements.append(
            "ALTER TABLE sg_offer ADD COLUMN source_slug VARCHAR(128) NULL AFTER image_url"
        )
    if "lead_days" not in cols:
        statements.append(
            "ALTER TABLE sg_offer ADD COLUMN lead_days SMALLINT NULL AFTER source_slug"
        )
    if "source_url" not in cols:
        statements.append(
            "ALTER TABLE sg_offer ADD COLUMN source_url VARCHAR(512) NULL AFTER lead_days"
        )
    for sql in statements:
        cur.execute(sql)
    cur.execute("SHOW INDEX FROM sg_offer")
    index_names = {row[2] for row in cur.fetchall()}
    if "idx_sg_offer_source_slug" not in index_names:
        cur.execute("CREATE INDEX idx_sg_offer_source_slug ON sg_offer (source_slug)")


def upsert_categories(cur) -> None:
    sql = """
    INSERT INTO sg_categories (slug, name_th, name_en, vibe, target_recipient)
    VALUES (%s, %s, %s, %s, %s)
    ON DUPLICATE KEY UPDATE
      name_th = VALUES(name_th),
      name_en = VALUES(name_en),
      vibe = VALUES(vibe)
    """
    for slug, name_th, name_en, vibe in WEBSITE_CATEGORIES:
        cur.execute(sql, (slug, name_th, name_en, vibe, "องค์กร / ของขวัญพรีเมียม"))


def upsert_catalog(cur, products: list[dict[str, Any]]) -> tuple[int, int]:
    product_sql = """
    INSERT INTO sg_products
      (code, name_th, name_en, category_slug, category_name, srp_price, source)
    VALUES (%s, %s, %s, %s, %s, %s, 'smartgift_website')
    ON DUPLICATE KEY UPDATE
      name_th = VALUES(name_th),
      name_en = VALUES(name_en),
      category_slug = VALUES(category_slug),
      category_name = VALUES(category_name)
    """
    offer_sql = """
    INSERT INTO sg_offer (
      offer_code, name, gift_tier, supplier_code, interest_theme, interest_theme_slug,
      catalog_match_status, unboxing_experience, image_url, source_slug, lead_days,
      source_url, product_family, price_source, has_price, price_min, price_max
    ) VALUES (
      %s, %s, NULL, 'WEB', %s, %s, 'website', %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
    )
    ON DUPLICATE KEY UPDATE
      name = VALUES(name),
      interest_theme = VALUES(interest_theme),
      interest_theme_slug = VALUES(interest_theme_slug),
      unboxing_experience = VALUES(unboxing_experience),
      image_url = VALUES(image_url),
      source_slug = VALUES(source_slug),
      lead_days = VALUES(lead_days),
      source_url = VALUES(source_url),
      product_family = VALUES(product_family),
      price_source = IF(VALUES(has_price) = 1, VALUES(price_source), price_source),
      has_price = IF(VALUES(has_price) = 1, 1, has_price),
      price_min = IF(VALUES(has_price) = 1, VALUES(price_min), price_min),
      price_max = IF(VALUES(has_price) = 1, VALUES(price_max), price_max)
    """
    price_sql = """
    INSERT INTO sg_offer_price
      (offer_code, supplier_code, min_qty, unit_price, unit_price_with_vat, currency, price_source, commercial_sku)
    VALUES (%s, 'WEB', %s, %s, %s, 'THB', 'website', %s)
    ON DUPLICATE KEY UPDATE
      unit_price = VALUES(unit_price),
      unit_price_with_vat = VALUES(unit_price_with_vat),
      price_source = VALUES(price_source)
    """
    cat_names = {slug: name_th for slug, name_th, *_ in WEBSITE_CATEGORIES}
    offers = 0
    priced = 0
    for item in products:
        code = str(item.get("code") or "").strip().upper()[:32]
        name = str(item.get("name") or "").strip()[:255]
        if not code or not name:
            continue
        slug = str(item.get("slug") or code.lower())[:128]
        category = str(item.get("category") or "gift-set").strip() or "gift-set"
        if category not in cat_names:
            category = "gift-set"
        english = str(item.get("englishName") or name)[:255]
        description = str(item.get("description") or "").strip()
        image = absolute_image(item.get("image"))
        source_url = f"{SITE}/premium-gifts/products/{slug}"
        moq = item.get("moq")
        lead = item.get("leadDays")
        tiers = [
            t
            for t in (item.get("tiers") or [])
            if isinstance(t, dict) and t.get("min") and t.get("price") is not None
        ]
        prices = [float(t["price"]) for t in tiers]
        has_price = 1 if prices else 0
        price_min = min(prices) if prices else None
        price_max = max(prices) if prices else None
        srp = price_min if price_min is not None else 0
        cur.execute(
            product_sql,
            (code, name, english, category, cat_names[category], srp),
        )
        cur.execute(
            offer_sql,
            (
                code,
                name,
                cat_names[category],
                category,
                description or None,
                image,
                slug,
                int(lead) if lead not in (None, "") else None,
                source_url,
                category,
                "website" if has_price else None,
                has_price,
                price_min,
                price_max,
            ),
        )
        offers += 1
        for tier in tiers:
            qty = int(tier["min"])
            unit = float(tier["price"])
            vat = round(unit * 1.07, 2)
            cur.execute(
                price_sql,
                (code, qty, unit, vat, f"{code}(WEB)-{qty}"),
            )
            priced += 1
        _ = moq
    return offers, priced


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    print(f"Fetching {SITE}{SEARCH_PATH}")
    html = decode_js(fetch(SITE + SEARCH_PATH))
    products = extract_from_chunks(html)
    print(f"Extracted {len(products)} offers from the live website")
    priced_live = sum(1 for row in products.values() if row.get("tiers"))
    print(f"With qty price ladders: {priced_live}")
    if not products:
        print("No products found — aborting", file=sys.stderr)
        return 1

    snapshot = ROOT / ".data" / "smartgift-website-catalog.json"
    snapshot.parent.mkdir(parents=True, exist_ok=True)
    snapshot.write_text(
        json.dumps(
            {
                "source": SITE + SEARCH_PATH,
                "count": len(products),
                "priced": priced_live,
                "products": sorted(products.values(), key=lambda p: str(p.get("code"))),
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"Wrote snapshot {snapshot}")

    if args.dry_run:
        return 0

    conn = connect()
    try:
        cur = conn.cursor()
        ensure_columns(cur)
        upsert_categories(cur)
        offers, price_rows = upsert_catalog(cur, list(products.values()))
        conn.commit()
        cur.execute("SELECT COUNT(*) FROM sg_offer")
        total = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM sg_offer WHERE has_price = 1")
        priced = cur.fetchone()[0]
        print(f"Upserted {offers} offers, {price_rows} website price rows")
        print(f"sg_offer now {total} rows ({priced} with a price)")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
