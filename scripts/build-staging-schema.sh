#!/usr/bin/env bash
# Build a REPLAY-SAFE staging schema from sql/_baseline/schema.sql.
#
# Why: sql/_baseline/schema.sql is a drift-reference capture (scripts/capture-schema.mjs),
# NOT a deploy artifact. Applied as-is to a fresh DB it fails because the capture:
#   1. renders generated tsvector columns as DEFAULT (not GENERATED ALWAYS AS ... STORED)
#   2. omits CREATE SEQUENCE for nextval()-backed columns (e.g. audit_log_id_seq)
#   3. emits sections in replay-hostile order (FKs before PKs; functions after the
#      policies/triggers that call them)
#   4. orders functions by name, so SQL functions can reference a not-yet-created function
# This script fixes all four so the output applies cleanly to the staging Supabase project.
#
# Usage (from repo root, with the CLI linked to STAGING):
#   bash scripts/build-staging-schema.sh > /tmp/staging.sql
#   npx supabase db query --linked -f /tmp/staging.sql          # then publication.sql
# Full procedure + the staging project ref live in tasks/spec-staging-environment.md.
#
# Follow-up: teaching scripts/capture-schema.mjs to emit these (SET check_function_bodies,
# CREATE SEQUENCE, generated columns, dependency order) would make this script unnecessary.

set -euo pipefail
SRC="${1:-sql/_baseline/schema.sql}"
TMP="$(mktemp)"

# (1) generated-column DEFAULT -> GENERATED ALWAYS AS (...) STORED
perl -pe 'if (/search_tsv tsvector DEFAULT/) { s/DEFAULT \((.*)\)(\s*)$/GENERATED ALWAYS AS ($1) STORED$2/ }' "$SRC" > "$TMP"

# (4) defer function-body validation so function order does not matter
echo "SET check_function_bodies = false;"
# (2) create any sequence referenced by a nextval() default, before the tables
grep -oE "nextval\('[a-zA-Z0-9_.]+" "$TMP" | sed "s/nextval('//" | sort -u | while read -r seq; do
  echo "CREATE SEQUENCE IF NOT EXISTS public.${seq};"
done

# (3) reorder sections: tables -> functions -> PK/UNIQUE/CHECK -> FK -> indexes -> RLS-enable -> triggers -> policies
ln() { grep -nE "^-- $1" "$TMP" | head -1 | cut -d: -f1; }
C=$(ln "CONSTRAINTS"); I=$(ln "INDEXES"); R=$(ln "ROW LEVEL SECURITY"); P=$(ln "RLS POLICIES"); T=$(ln "TRIGGERS"); F=$(ln "FUNCTIONS")
sed -n "1,$((C-1))p"        "$TMP"                        # header + TABLES
sed -n "${F},\$p"           "$TMP"                        # FUNCTIONS
sed -n "${C},$((I-1))p"     "$TMP" | grep -v "FOREIGN KEY"  # PK / UNIQUE / CHECK
sed -n "${C},$((I-1))p"     "$TMP" | grep "FOREIGN KEY"     # FK last
sed -n "${I},$((R-1))p"     "$TMP"                        # INDEXES
sed -n "${R},$((P-1))p"     "$TMP"                        # RLS enable
sed -n "${T},$((F-1))p"     "$TMP"                        # TRIGGERS
sed -n "${P},$((T-1))p"     "$TMP"                        # POLICIES

rm -f "$TMP"
