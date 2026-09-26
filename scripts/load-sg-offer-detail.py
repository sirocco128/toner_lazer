#!/usr/bin/env python3
"""Load catalog_offers JSON into sg_offer / sg_offer_item / sg_offer_price."""

from __future__ import annotations

import json
from pathlib import Path

JSON_PATH = Path(r"C:\Users\Admin\Downloads\1smartgift_catalog_master.json")
DDL_PATH = Path(r"D:\mcp_alibaba\premium-giftset-web\db\mysql\sg_offer_detail.sql")
SQL_OUT = Path(r"C:\Users\Admin\Downloads\1smartgift_offer_detail.sql")
PROJECT_SQL = Path(r"D:\mcp_alibaba\premium-giftset-web\db\mysql\sg_offer_detail_data.sql")


def sql_str(value: object | None) -> str:
    if value is None or value == "":
        return "NULL"
    return "'" + str(value).replace("\\", "\\\\").replace("'", "''") + "'"


def sql_int(value: object | None) -> str:
    if value is None or value == "":
        return "NULL"
    return str(int(value))


def sql_num(value: object | None) -> str:
    if value is None:
        return "NULL"
    return str(value)


def chunked(rows: list[str], size: int) -> list[list[str]]:
    return [rows[i : i + size] for i in range(0, len(rows), size)]


def emit(table: str, columns: str, rows: list[str], out: list[str], size: int = 80) -> None:
    if not rows:
        return
    for batch in chunked(rows, size):
        out.append(f"INSERT INTO {table} ({columns}) VALUES")
        out.append(",\n".join(f"  ({row})" for row in batch) + ";")
        out.append("")


def build_data_sql(catalog: dict) -> str:
    out: list[str] = [
        "SET NAMES utf8mb4;",
        "USE smartgift;",
        "SET FOREIGN_KEY_CHECKS = 0;",
        "DELETE FROM sg_offer_alias;",
        "DELETE FROM sg_offer_price;",
        "DELETE FROM sg_offer_item;",
        "DELETE FROM sg_offer;",
        "SET FOREIGN_KEY_CHECKS = 1;",
        "",
    ]
    offer_rows: list[str] = []
    item_rows: list[str] = []
    price_rows: list[str] = []
    alias_rows: list[str] = []

    for offer in catalog.get("catalog_offers") or []:
        code = offer.get("offer_code")
        tiers = offer.get("price_tiers") or []
        prices = [float(t["unit_price"]) for t in tiers if t.get("unit_price") is not None]
        supplier = offer.get("supplier_code")
        source = offer.get("price_source") or ("catalog_json" if tiers else None)
        offer_rows.append(
            ", ".join(
                [
                    sql_str(code),
                    sql_str(offer.get("name")),
                    sql_str(offer.get("gift_tier")),
                    sql_str(supplier),
                    sql_str(offer.get("interest_theme")),
                    sql_str(offer.get("interest_theme_slug")),
                    sql_str(offer.get("catalog_match_status")),
                    sql_str(offer.get("unboxing_experience")),
                    sql_str(offer.get("product_master")),
                    sql_str(offer.get("product_family")),
                    sql_int(offer.get("page")),
                    sql_str(source),
                    "1" if prices else "0",
                    sql_num(min(prices) if prices else None),
                    sql_num(max(prices) if prices else None),
                ]
            )
        )
        for line_no, component in enumerate(offer.get("components") or [], start=1):
            item_rows.append(
                ", ".join(
                    [
                        sql_str(code),
                        str(line_no),
                        sql_str(component.get("product_code")),
                        sql_int(component.get("qty") or 1),
                    ]
                )
            )
        for tier in tiers:
            unit = float(tier["unit_price"])
            supplier_key = supplier or ""
            qty = int(tier.get("min_qty"))
            price_rows.append(
                ", ".join(
                    [
                        sql_str(code),
                        sql_str(supplier_key) if supplier_key else "''",
                        sql_int(qty),
                        sql_num(unit),
                        sql_num(round(unit * 1.07, 2)),
                        "'THB'",
                        sql_str(source or "catalog_json"),
                        sql_str(f"{code}({supplier_key})-{qty}"),
                    ]
                )
            )
        seen = set()
        for alias in offer.get("aliases") or []:
            text = str(alias).strip()
            if not text or text in seen:
                continue
            seen.add(text)
            alias_rows.append(", ".join([sql_str(code), sql_str(text)]))

    emit(
        "sg_offer",
        "offer_code, name, gift_tier, supplier_code, interest_theme, interest_theme_slug, catalog_match_status, unboxing_experience, product_master, product_family, catalog_page, price_source, has_price, price_min, price_max",
        offer_rows,
        out,
        size=40,
    )
    emit("sg_offer_item", "offer_code, line_no, product_code, qty", item_rows, out)
    emit(
        "sg_offer_price",
        "offer_code, supplier_code, min_qty, unit_price, unit_price_with_vat, currency, price_source, commercial_sku",
        price_rows,
        out,
    )
    emit("sg_offer_alias", "offer_code, alias", alias_rows, out)

    out.append("""INSERT INTO sg_offer_price (
  offer_code, supplier_code, min_qty, unit_price, unit_price_with_vat, currency, price_source, commercial_sku
)
SELECT
  p.offer_code,
  IFNULL(p.price_list_group, ''),
  p.qty_tier,
  p.unit_price,
  p.unit_price_with_vat,
  'THB',
  'flowaccount',
  CONCAT(p.offer_code, '(', IFNULL(p.price_list_group, ''), ')-', p.qty_tier)
FROM smartgift_price p
JOIN sg_offer o ON o.offer_code = p.offer_code
WHERE p.price_missing = 0
  AND p.qty_tier IS NOT NULL
  AND p.unit_price IS NOT NULL
  AND p.unit_price > 0
ON DUPLICATE KEY UPDATE
  unit_price = VALUES(unit_price),
  unit_price_with_vat = VALUES(unit_price_with_vat),
  price_source = 'flowaccount',
  commercial_sku = VALUES(commercial_sku);
""")
    out.append("""UPDATE sg_offer o
JOIN (
  SELECT offer_code, MIN(unit_price) AS price_min, MAX(unit_price) AS price_max
  FROM sg_offer_price
  GROUP BY offer_code
) p ON p.offer_code = o.offer_code
SET o.has_price = 1, o.price_min = p.price_min, o.price_max = p.price_max;
""")
    return "\n".join(out)


def main() -> None:
    catalog = json.loads(JSON_PATH.read_text(encoding="utf-8"))
    ddl = DDL_PATH.read_text(encoding="utf-8")
    data = build_data_sql(catalog)
    combined = ddl.rstrip() + "\n\n" + data
    SQL_OUT.write_text(combined, encoding="utf-8")
    PROJECT_SQL.write_text(data, encoding="utf-8")
    print(f"wrote {SQL_OUT} ({SQL_OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
