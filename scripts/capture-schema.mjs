#!/usr/bin/env node
// Infra-as-code: capture the live public schema into a versioned baseline,
// WITHOUT Docker (the Supabase CLI `db dump` needs a containerized pg_dump;
// this uses the `db query --linked` API path instead, which is available).
//
// Most sections use Postgres's OWN DDL generators, so they are EXACT:
//   functions   -> pg_get_functiondef
//   triggers    -> pg_get_triggerdef
//   constraints -> pg_get_constraintdef
//   indexes     -> pg_indexes.indexdef
// Two sections are reconstructed (and spot-checked): CREATE TABLE column lists
// (from pg_attribute) and CREATE POLICY (from pg_policies). The result is a
// faithful, regenerable baseline - NOT a deploy artifact (we never db-reset
// prod from it); it is for version control, code review, and drift awareness.
//
//   node scripts/capture-schema.mjs            # writes sql/_baseline/schema.sql
//
// Re-run whenever the schema changes to refresh the baseline.

import { writeFileSync, mkdtempSync, mkdirSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const OUT = 'sql/_baseline/schema.sql'
const tmp = mkdtempSync(join(tmpdir(), 'capschema-'))

// Each section: a label + a query that returns ONE text column named `ddl`,
// one complete statement per row.
const SECTIONS = [
  {
    label: 'TABLES (columns; constraints + indexes follow below)',
    sql: `select format('CREATE TABLE public.%I (', c.relname) || E'\\n' ||
            string_agg(
              '  ' || quote_ident(a.attname) || ' ' || format_type(a.atttypid, a.atttypmod) ||
              case when a.attnotnull then ' NOT NULL' else '' end ||
              case when ad.adbin is not null then ' DEFAULT ' || pg_get_expr(ad.adbin, ad.adrelid) else '' end,
              ',' || E'\\n' order by a.attnum
            ) || E'\\n);' as ddl
          from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
          join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
          left join pg_attrdef ad on ad.adrelid = c.oid and ad.adnum = a.attnum
          where n.nspname = 'public' and c.relkind = 'r'
          group by c.relname
          order by c.relname;`,
  },
  {
    label: 'CONSTRAINTS (PK / FK / UNIQUE / CHECK)',
    sql: `select format('ALTER TABLE public.%I ADD CONSTRAINT %I %s;', c.relname, con.conname, pg_get_constraintdef(con.oid)) as ddl
          from pg_constraint con
          join pg_class c on c.oid = con.conrelid
          join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public'
          order by c.relname, con.conname;`,
  },
  {
    label: 'INDEXES (excluding those backing a PK/UNIQUE constraint)',
    sql: `select indexdef || ';' as ddl
          from pg_indexes
          where schemaname = 'public'
            and indexname not in (select conname from pg_constraint where contype in ('p','u'))
          order by tablename, indexname;`,
  },
  {
    label: 'ROW LEVEL SECURITY (enable)',
    sql: `select format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', c.relname) as ddl
          from pg_class c join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
          order by c.relname;`,
  },
  {
    label: 'RLS POLICIES (286 reconstructed from pg_policies)',
    sql: `select format(
            'CREATE POLICY %I ON public.%I AS %s FOR %s TO %s%s%s;',
            policyname, tablename,
            case when permissive = 'PERMISSIVE' then 'PERMISSIVE' else 'RESTRICTIVE' end,
            cmd,
            array_to_string(roles, ', '),
            case when qual is not null then ' USING (' || qual || ')' else '' end,
            case when with_check is not null then ' WITH CHECK (' || with_check || ')' else '' end
          ) as ddl
          from pg_policies
          where schemaname = 'public'
          order by tablename, policyname;`,
  },
  {
    label: 'TRIGGERS (pg_get_triggerdef - exact)',
    sql: `select pg_get_triggerdef(t.oid) || ';' as ddl
          from pg_trigger t
          join pg_class c on c.oid = t.tgrelid
          join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and not t.tgisinternal
          order by c.relname, t.tgname;`,
  },
  {
    label: 'FUNCTIONS / PROCEDURES (pg_get_functiondef - exact)',
    sql: `select pg_get_functiondef(p.oid) || ';' as ddl
          from pg_proc p
          join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.prokind in ('f','p')
          order by p.proname;`,
  },
]

function runQuery(sql) {
  const qPath = join(tmp, 'q.sql')
  writeFileSync(qPath, sql)
  const out = execSync(`npx supabase db query --linked -f "${qPath}"`, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
  })
  const start = out.indexOf('{')
  const end = out.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('no JSON in CLI output')
  const parsed = JSON.parse(out.slice(start, end + 1))
  return Array.isArray(parsed.rows) ? parsed.rows.map((r) => r.ddl) : []
}

mkdirSync('sql/_baseline', { recursive: true })

const header = `-- CANONICAL public schema baseline (infra-as-code).
-- GENERATED by scripts/capture-schema.mjs from the LIVE linked DB via the
-- Supabase query API (no Docker). Most sections use Postgres's own DDL
-- generators (functions/triggers/constraints/indexes = exact); TABLES and
-- POLICIES are reconstructed faithfully. This is a VERSIONED RECORD + drift
-- reference, NOT a deploy artifact - do NOT db-reset prod from it.
--
-- Refresh: node scripts/capture-schema.mjs
-- Publication membership lives separately in sql/_baseline/publication.sql.
-- Captured: ${new Date().toISOString().slice(0, 10)}
`

const parts = [header]
const counts = {}
for (const { label, sql } of SECTIONS) {
  process.stderr.write(`capturing: ${label} ... `)
  const rows = runQuery(sql)
  counts[label] = rows.length
  process.stderr.write(`${rows.length}\n`)
  parts.push(`\n-- ============================================================\n-- ${label}\n-- ============================================================\n`)
  parts.push(rows.join('\n\n') + '\n')
}

writeFileSync(OUT, parts.join(''))
process.stderr.write(`\nWrote ${OUT}\n`)
for (const [k, v] of Object.entries(counts)) process.stderr.write(`  ${v}\t${k}\n`)
