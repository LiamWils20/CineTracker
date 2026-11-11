alter table public.watchlist_items
    add column if not exists tmdb_id bigint,
    add column if not exists poster_path text,
    add column if not exists overview text,
    add column if not exists release_date text;
