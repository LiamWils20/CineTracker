create table public.game_items (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    title text not null,
    status text not null default 'planned'
        check (status in ('planned', 'playing', 'completed')),
    rawg_id bigint,
    cover_url text,
    description text,
    release_date text,
    created_at timestamptz not null default now()
);

create index game_items_user_id_created_at_idx
    on public.game_items (user_id, created_at desc);

alter table public.game_items enable row level security;

grant select, insert, update, delete on public.game_items to authenticated;

create policy "Users can view their own games"
    on public.game_items for select
    to authenticated
    using ((select auth.uid()) = user_id);

create policy "Users can add their own games"
    on public.game_items for insert
    to authenticated
    with check ((select auth.uid()) = user_id);

create policy "Users can update their own games"
    on public.game_items for update
    to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);

create policy "Users can delete their own games"
    on public.game_items for delete
    to authenticated
    using ((select auth.uid()) = user_id);