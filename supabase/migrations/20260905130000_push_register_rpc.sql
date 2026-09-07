-- MGames 2026 — register push subscriptions through a function, not the table.
--
-- The permissive INSERT/UPDATE policies added with this table did not actually
-- work for the app's code path. supabase-js `.upsert()` issues
-- `INSERT ... ON CONFLICT DO UPDATE`, and Postgres needs a SELECT policy to
-- read the conflicting row before it can take the UPDATE branch. This table
-- deliberately has no SELECT policy — the endpoints in it are the only thing
-- stopping a stranger pushing to every device that ever opted in — so every
-- subscribe attempt failed with 42501.
--
-- Granting SELECT to fix that would hand out the whole endpoint list. Instead
-- registration goes through SECURITY DEFINER functions, which run above RLS,
-- and the table loses its client-facing policies entirely. That is strictly
-- tighter than before: there is now exactly one way in, and it can only touch
-- the row matching the endpoint the caller already holds.

drop policy if exists "anyone may register a subscription" on push_subscriptions;
drop policy if exists "anyone may refresh their own subscription" on push_subscriptions;
drop policy if exists "anyone may remove their own subscription" on push_subscriptions;

create or replace function register_push_subscription(
  p_endpoint text,
  p_p256dh   text,
  p_auth     text,
  p_team_ids uuid[]
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into push_subscriptions (endpoint, p256dh, auth, team_ids)
  values (p_endpoint, p_p256dh, p_auth, coalesce(p_team_ids, '{}'::uuid[]))
  on conflict (endpoint) do update
    set p256dh     = excluded.p256dh,
        auth       = excluded.auth,
        team_ids   = excluded.team_ids,
        updated_at = now();
$$;

-- Deleting by endpoint is safe to expose: the endpoint is an unguessable
-- secret issued by the push service, so only the browser that owns a
-- subscription can name it.
create or replace function unregister_push_subscription(p_endpoint text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from push_subscriptions where endpoint = p_endpoint;
$$;

grant execute on function register_push_subscription(text, text, text, uuid[]) to anon, authenticated;
grant execute on function unregister_push_subscription(text) to anon, authenticated;
