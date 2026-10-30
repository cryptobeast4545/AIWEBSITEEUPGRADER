import json
import os
import logging
from urllib.parse import urlparse, unquote

import asyncpg
from fastapi import HTTPException

logger = logging.getLogger(__name__)
_pool = None

SCHEMA = """
create table if not exists al_sites (
  id text primary key,
  user_id text not null,
  name text not null,
  url text not null,
  whatsapp text default '',
  alert_email text default '',
  alerts_enabled boolean default true,
  autofix boolean default true,
  voice_enabled boolean default true,
  ai_alt boolean default true,
  app_origin text default '',
  created_at timestamptz default now()
);
create index if not exists al_sites_user on al_sites(user_id);
create table if not exists al_audits (
  id text primary key,
  site_id text,
  user_id text,
  source text not null,
  url text not null,
  a11y_score int not null,
  seo_score int,
  counts jsonb not null default '{}',
  violations jsonb not null default '[]',
  seo jsonb not null default '[]',
  fixes jsonb not null default '{}',
  meta jsonb not null default '{}',
  created_at timestamptz default now()
);
create index if not exists al_audits_site on al_audits(site_id, created_at desc);
create table if not exists al_alt_cache (
  src text primary key,
  alt text not null,
  created_at timestamptz default now()
);
create table if not exists al_wa_log (
  id bigserial primary key,
  phone text not null,
  direction text not null,
  body text not null,
  created_at timestamptz default now()
);
"""


async def _init_conn(conn):
    await conn.set_type_codec("jsonb", encoder=json.dumps, decoder=json.loads, schema="pg_catalog")


async def connect():
    global _pool
    url = os.environ.get("SUPABASE_DB_URL")
    if not url:
        logger.warning("SUPABASE_DB_URL not set; database features disabled")
        return
    kw = {"dsn": url}
    u = urlparse(url)
    pooler = os.environ.get("SUPABASE_POOLER_HOST")
    if pooler and u.hostname and u.hostname.startswith("db.") and u.hostname.endswith(".supabase.co"):
        ref = u.hostname.split(".")[1]
        kw = {"host": pooler, "port": 6543, "user": f"postgres.{ref}", "password": unquote(u.password or ""),
              "database": (u.path or "/postgres").lstrip("/") or "postgres"}
    _pool = await asyncpg.create_pool(**kw, min_size=1, max_size=8, statement_cache_size=0,
                                      init=_init_conn, command_timeout=30)
    async with _pool.acquire() as conn:
        await conn.execute(SCHEMA)
        await conn.execute(
            "insert into al_sites (id, user_id, name, url) values ('demo','system','AccessLayer Demo','https://demo.accesslayer.io') on conflict (id) do nothing")
    logger.info("Supabase connected")


async def close():
    if _pool:
        await _pool.close()


def pool():
    if not _pool:
        raise HTTPException(503, "Database is not configured yet")
    return _pool


def row(r):
    if r is None:
        return None
    d = dict(r)
    for k, v in d.items():
        if hasattr(v, "isoformat"):
            d[k] = v.isoformat()
    return d


async def fetch(q, *a):
    return [row(r) for r in await pool().fetch(q, *a)]


async def fetchrow(q, *a):
    return row(await pool().fetchrow(q, *a))


async def execute(q, *a):
    return await pool().execute(q, *a)
