/**
 * Diagnostic script to inspect existing SQLite reports for suspicious or invalid locations.
 * Read-only: never modifies database rows.
 * Usage: node scripts/check_locations.js
 */

const path = require("node:path");
const fs = require("node:fs");
const { DatabaseSync } = require("node:sqlite");

const dbPath = path.join(__dirname, "..", "campus_blackbox.db");
if (!fs.existsSync(dbPath)) {
  console.log("Database not found at:", dbPath);
  process.exit(0);
}

const db = new DatabaseSync(dbPath, { readOnly: true });

const rows = db.prepare(`
  SELECT r.id, r.user_id, r.location_id, r.description, r.status, r.created_at,
         l.id AS joined_loc_id, l.block, l.room
  FROM reports r
  LEFT JOIN locations l ON r.location_id = l.id
  ORDER BY r.id ASC
`).all();

const suspicious = [];
const dist = new Map();

for (const row of rows) {
  const key = `${row.location_id ?? "NULL"} -> ${row.block ?? "MISSING"} | ${row.room ?? "MISSING"}`;
  dist.set(key, (dist.get(key) || 0) + 1);

  const reasons = [];
  if (row.location_id == null || row.location_id <= 0) {
    reasons.push("missing_location_id");
  }
  if (!row.joined_loc_id) {
    reasons.push("orphaned_location_id");
  }
  if (!row.block || !String(row.block).trim()) {
    reasons.push("empty_block");
  }
  if (!row.room || !String(row.room).trim() || /^room$/i.test(String(row.room).trim())) {
    reasons.push("missing_or_generic_room");
  }
  if (row.location_id === 1 && row.description && /block\s*[234]|library/i.test(row.description)) {
    reasons.push("description_mentions_other_block_but_location_id_is_1");
  }

  if (reasons.length > 0) {
    suspicious.push({
      id: row.id,
      location_id: row.location_id,
      block: row.block ?? null,
      room: row.room ?? null,
      created_at: row.created_at,
      reasons,
      description: String(row.description || "").slice(0, 80),
    });
  }
}

console.log("=== Campus Black Box — Location Audit (Read-Only) ===");
console.log(`Total reports scanned: ${rows.length}`);
console.log("\nLocation distribution:");
for (const [k, count] of dist.entries()) {
  console.log(`  ${k}: ${count}`);
}

console.log(`\nSuspicious reports found: ${suspicious.length}`);
if (suspicious.length > 0) {
  console.table(suspicious);
  console.log("\nTip: Delete campus_blackbox.db (or reset it) and restart server.js to reseed clean demo data.");
} else {
  console.log("All scanned reports have valid joined block & room entries.");
}

