alter table public.game_items
    add column if not exists igdb_id bigint;
