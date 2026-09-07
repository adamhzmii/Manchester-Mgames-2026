-- MGames 2026 — Web Push subscriptions.
--
-- One row per browser that has agreed to receive notifications. Attendees
-- never sign in, so a subscription is not tied to a user: the endpoint the
-- push service issues *is* the identity, and it is unguessable.

create table push_subscriptions (
  -- The push service's endpoint URL, unique per browser install. Natural key:
  -- a browser that re-subscribes hands back the same endpoint, so upserting on
  -- it avoids piling up duplicates that would send the same person three
  -- copies of every notification.
  endpoint    text primary key,
  p256dh      text not null,
  auth        text not null,
  -- Which teams this browser follows, so a "your team is on next" push can go
  -- only to the people it concerns. Empty means announcements only.
  team_ids    uuid[] not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index push_subscriptions_team_ids_idx on push_subscriptions using gin (team_ids);

create trigger push_subscriptions_set_updated_at
  before update on push_subscriptions
  for each row
  execute function set_updated_at();

alter table push_subscriptions enable row level security;

-- Anonymous visitors must be able to register and update their own
-- subscription, since they never authenticate.
--
-- There is deliberately no SELECT policy: nobody reading this table through
-- the API is a legitimate case, and the endpoints are the only thing standing
-- between a stranger and the ability to push to every device. Sending runs
-- server-side under the service role, which bypasses RLS entirely.
create policy "anyone may register a subscription"
  on push_subscriptions for insert to anon, authenticated
  with check (true);

create policy "anyone may refresh their own subscription"
  on push_subscriptions for update to anon, authenticated
  using (true) with check (true);

-- A browser revoking permission should be able to clean up after itself.
create policy "anyone may remove their own subscription"
  on push_subscriptions for delete to anon, authenticated
  using (true);
