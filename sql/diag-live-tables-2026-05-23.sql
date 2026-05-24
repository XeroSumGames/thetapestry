select string_agg(tablename, ' ' order by tablename) as tables
from pg_tables where schemaname='public';
