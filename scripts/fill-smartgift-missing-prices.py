#!/usr/bin/env python3
"""Fill missing SmartGift price tiers from FlowAccount (smartgift_price).

The catalog JSON cloned a dummy ladder (10=1200, 20/50=980, 100/500=850).
Real qty 10/20/50/100/500 prices live in smartgiftpricelist.postgres.sql.
"""

from __future__ import annotations

import json
import re
from collections import defaultdict
from pathlib import Path

JSON_PATH = Path(r"C:\Users\Admin\Downloads\1smartgift_catalog_master.json")
PG_PATH = Path(r"C:\Users\Admin\Downloads\smartgiftpricelist.postgres.sql")
SQL_OUT = Path(r"C:\Users\Admin\Downloads\1smartgift_price_fill.sql")
PROJECT_SQL = Path(r"D:\mcp_alibaba\premium-giftset-web\db\mysql\smartgift_price_fill.sql")

CLONE = {10: 1200.0, 20: 980.0, 50: 980.0, 100: 850.0, 500: 850.0}
STANDARD = (10, 20, 50, 100, 500)
ROW_RE = re.compile(
    r"INSERT INTO smartgift_price \(id, offer_code, qty_tier, unit_price, "
    r"unit_price_with_vat, price_missing, price_list_group, flow_account_code, "
    r"flow_account_name, export_date, source_ref\) VALUES \("
    r"(\d+), ('[^']*'|NULL), ([^,]*), ([^,]*), ([^,]*), (TRUE|FALSE|true|false), "
    r"('[^']*'|NULL), ('[^']*'|NULL), ('[^']*'|NULL), ('[^']*'|NULL), "
    r"('(?:\\'|[^'])*'|NULL)\);",
    re.I,
)


def unquote(value: str) -> str | None:
    if value is None or value.upper() == "NULL":
        return None
    if value.startswith("'") and value.endswith("'"):
        return value[1:-1].replace("''", "'")
    return value


def sql_str(value: object | None) -> str:
    if value is None:
        return "NULL"
    return "'" + str(value).replace("\\", "\\\\").replace("'", "''") + "'"


def sql_num(value: object | None) -> str:
    if value is None:
        return "NULL"
    return str(value)


def parse_pg_prices(sql: str) -> list[dict]:
    rows = []
    for match in ROW_RE.finditer(sql):
        (
            row_id,
            offer_code,
            qty,
            price,
            vat,
            missing,
            group,
            fa_code,
            fa_name,
            export_date,
            source_ref,
        ) = match.groups()
        qty_val = None if qty.strip().upper() == "NULL" else int(qty)
        price_val = None if price.strip().upper() == "NULL" else float(price)
        vat_val = None if vat.strip().upper() == "NULL" else float(vat)
        rows.append(
            {
                "id": int(row_id),
                "offer_code": unquote(offer_code),
                "qty_tier": qty_val,
                "unit_price": price_val,
                "unit_price_with_vat": vat_val,
                "price_missing": missing.lower() == "true",
                "price_list_group": unquote(group),
                "flow_account_code": unquote(fa_code),
                "flow_account_name": unquote(fa_name),
                "export_date": unquote(export_date),
                "source_ref": unquote(source_ref),
            }
        )
    return rows


def is_clone(tiers: list[dict]) -> bool:
    by_qty = {int(t["min_qty"]): float(t["unit_price"]) for t in tiers}
    return all(by_qty.get(qty) == CLONE[qty] for qty in STANDARD) and set(STANDARD).issubset(by_qty)


def fa_tiers_for(offer_code: str, supplier: str | None, by_offer: dict) -> list[dict]:
    groups = by_offer.get(offer_code) or {}
    if supplier and supplier in groups:
        chosen = groups[supplier]
    elif len(groups) == 1:
        chosen = next(iter(groups.values()))
    else:
        return []
    out = []
    for qty in STANDARD:
        if qty in chosen and chosen[qty]["unit_price"] not in (None, 0) and not chosen[qty]["price_missing"]:
            out.append({"min_qty": qty, "unit_price": chosen[qty]["unit_price"]})
    return out


def patch_json(catalog: dict, rows: list[dict]) -> dict:
    by_offer: dict[str, dict[str, dict[int, dict]]] = defaultdict(lambda: defaultdict(dict))
    for row in rows:
        if row["qty_tier"] is None:
            continue
        by_offer[row["offer_code"]][row["price_list_group"]][row["qty_tier"]] = row

    replaced = 0
    filled_empty = 0
    for offer in catalog.get("catalog_offers") or []:
        tiers = offer.get("price_tiers") or []
        real = fa_tiers_for(offer.get("offer_code"), offer.get("supplier_code"), by_offer)
        if not real:
            continue
        if not tiers:
            offer["price_tiers"] = real
            offer["price_source"] = "flowaccount"
            filled_empty += 1
        elif is_clone(tiers):
            offer["price_tiers"] = real
            offer["price_source"] = "flowaccount"
            replaced += 1
    catalog.setdefault("metadata", {})["price_fill"] = {
        "replaced_cloned_offers": replaced,
        "filled_empty_offers": filled_empty,
        "source": "smartgiftpricelist.postgres.sql / flowaccount-product-2026-06-21.xlsx",
    }
    return {"replaced": replaced, "filled_empty": filled_empty}


def build_mysql(rows: list[dict], catalog: dict) -> str:
    out = [
        "-- Fill real FlowAccount price tiers (10/20/50/100/500) into MySQL",
        "SET NAMES utf8mb4;",
        "USE smartgift;",
        "",
        "DROP TABLE IF EXISTS smartgift_price;",
        """CREATE TABLE smartgift_price (
  id INT NOT NULL PRIMARY KEY,
  offer_code VARCHAR(64) NULL,
  qty_tier INT NULL,
  unit_price DECIMAL(12,2) NULL,
  unit_price_with_vat DECIMAL(12,2) NULL,
  price_missing TINYINT(1) NOT NULL DEFAULT 0,
  price_list_group VARCHAR(32) NULL,
  flow_account_code VARCHAR(128) NULL,
  flow_account_name VARCHAR(255) NULL,
  export_date DATE NULL,
  source_ref JSON NULL,
  KEY idx_smartgift_price_offer (offer_code, price_list_group, qty_tier)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
""",
    ]
    values = []
    for row in rows:
        values.append(
            "("
            + ", ".join(
                [
                    str(row["id"]),
                    sql_str(row["offer_code"]),
                    sql_num(row["qty_tier"]),
                    sql_num(row["unit_price"]),
                    sql_num(row["unit_price_with_vat"]),
                    "1" if row["price_missing"] else "0",
                    sql_str(row["price_list_group"]),
                    sql_str(row["flow_account_code"]),
                    sql_str(row["flow_account_name"]),
                    sql_str(row["export_date"]),
                    sql_str(row["source_ref"]),
                ]
            )
            + ")"
        )
    for i in range(0, len(values), 80):
        batch = values[i : i + 80]
        out.append(
            "INSERT INTO smartgift_price (id, offer_code, qty_tier, unit_price, unit_price_with_vat, price_missing, price_list_group, flow_account_code, flow_account_name, export_date, source_ref) VALUES"
        )
        out.append(",\n".join(f"  {row}" for row in batch) + ";")
        out.append("")

    out.append("ALTER TABLE product_prices DROP INDEX uk_product_prices_sku_qty;")
    out.append("ALTER TABLE product_prices ADD COLUMN price_list_group VARCHAR(32) NULL AFTER gift_tier;")
    out.append("ALTER TABLE product_prices ADD COLUMN unit_price_with_vat DECIMAL(12,2) NULL AFTER unit_price;")
    out.append("ALTER TABLE product_prices ADD COLUMN price_missing TINYINT(1) NOT NULL DEFAULT 0 AFTER unit_price_with_vat;")
    out.append(
        "ALTER TABLE product_prices ADD UNIQUE KEY uk_product_prices_sku_group_qty (item_type, sku, price_list_group, min_qty);"
    )
    out.append("DELETE FROM product_prices WHERE item_type = 'offer';")
    out.append("")

    offer_names = {o["offer_code"]: o.get("name") for o in catalog.get("catalog_offers") or []}
    offer_slugs = {o["offer_code"]: o.get("interest_theme_slug") for o in catalog.get("catalog_offers") or []}
    offer_tiers = {o["offer_code"]: o.get("gift_tier") for o in catalog.get("catalog_offers") or []}
    price_rows = []
    for row in rows:
        if row["price_missing"] or row["qty_tier"] is None or not row["unit_price"]:
            continue
        name = row["flow_account_name"] or offer_names.get(row["offer_code"]) or row["offer_code"]
        price_rows.append(
            "("
            + ", ".join(
                [
                    sql_str(row["offer_code"]),
                    "'offer'",
                    sql_str(name),
                    sql_str(offer_slugs.get(row["offer_code"])),
                    sql_str(offer_tiers.get(row["offer_code"])),
                    sql_str(row["price_list_group"]),
                    sql_num(row["qty_tier"]),
                    sql_num(row["unit_price"]),
                    sql_num(row["unit_price_with_vat"]),
                    "0",
                    "'THB'",
                    "'flowaccount'",
                ]
            )
            + ")"
        )

    # Keep unique JSON-only PDF offers that FlowAccount does not have.
    by_offer_group = {(r["offer_code"], r["price_list_group"]) for r in rows}
    for offer in catalog.get("catalog_offers") or []:
        code = offer["offer_code"]
        supplier = offer.get("supplier_code") or ""
        if (code, supplier) in by_offer_group or (code, supplier or None) in {
            (r["offer_code"], r["price_list_group"]) for r in rows
        }:
            continue
        if is_clone(offer.get("price_tiers") or []):
            continue
        for tier in offer.get("price_tiers") or []:
            price = float(tier["unit_price"])
            price_rows.append(
                "("
                + ", ".join(
                    [
                        sql_str(code),
                        "'offer'",
                        sql_str(offer.get("name")),
                        sql_str(offer.get("interest_theme_slug")),
                        sql_str(offer.get("gift_tier")),
                        "NULL",
                        sql_num(tier.get("min_qty")),
                        sql_num(price),
                        sql_num(round(price * 1.07, 2)),
                        "0",
                        "'THB'",
                        "'smartgift_2026_pdf'",
                    ]
                )
                + ")"
            )

    cols = "sku, item_type, name, category_slug, gift_tier, price_list_group, min_qty, unit_price, unit_price_with_vat, price_missing, currency, source"
    for i in range(0, len(price_rows), 80):
        batch = price_rows[i : i + 80]
        out.append(f"INSERT INTO product_prices ({cols}) VALUES")
        out.append(",\n".join(f"  {row}" for row in batch) + ";")
        out.append("")

    out.append(
        """UPDATE sg_catalog_offers o
JOIN (
  SELECT sku,
         MIN(unit_price) AS price_min,
         MAX(unit_price) AS price_max
  FROM product_prices
  WHERE item_type = 'offer'
  GROUP BY sku
) p ON o.offer_code = p.sku
SET o.has_price = 1, o.price_min = p.price_min, o.price_max = p.price_max;
"""
    )
    return "\n".join(out)


def main() -> None:
    catalog = json.loads(JSON_PATH.read_text(encoding="utf-8"))
    pg_sql = PG_PATH.read_text(encoding="utf-8")
    rows = parse_pg_prices(pg_sql)
    if len(rows) < 500:
        raise SystemExit(f"parsed only {len(rows)} smartgift_price rows")
    stats = patch_json(catalog, rows)
    JSON_PATH.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    sql = build_mysql(rows, catalog)
    SQL_OUT.write_text(sql, encoding="utf-8")
    PROJECT_SQL.parent.mkdir(parents=True, exist_ok=True)
    PROJECT_SQL.write_text(sql, encoding="utf-8")
    print(f"parsed_pg_prices {len(rows)}")
    print(f"replaced_cloned {stats['replaced']} filled_empty {stats['filled_empty']}")
    print(f"wrote {JSON_PATH}")
    print(f"wrote {SQL_OUT} ({SQL_OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
