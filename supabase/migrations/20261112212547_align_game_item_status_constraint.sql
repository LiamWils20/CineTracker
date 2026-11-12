alter table public.game_items
    drop constraint if exists game_items_status_check;

alter table public.game_items
    add constraint game_items_status_check
    check (status in ('planned', 'playing', 'completed'));
