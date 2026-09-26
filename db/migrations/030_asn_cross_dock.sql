-- ASN / cross-dock fields on factory PO + BIN-XDOCK location

ALTER TABLE factory_pos ADD COLUMN asn_eta TEXT;
ALTER TABLE factory_pos ADD COLUMN asn_qty INTEGER;
ALTER TABLE factory_pos ADD COLUMN asn_container TEXT;
ALTER TABLE factory_pos ADD COLUMN receive_mode TEXT NOT NULL DEFAULT 'cross_dock';

INSERT OR IGNORE INTO wms_locations (location_code, warehouse_code, name, kind, status, created_at)
VALUES ('BIN-XDOCK', 'WH-MAIN', 'จุดแพ็ก Cross-Dock', 'staging', 'active', datetime('now'));
