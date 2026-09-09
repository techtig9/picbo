# Granting platform admin access

`/admin` (the Picbo operations dashboard — users, MRR/ARR, provider costs,
cross-workspace failure feed) is gated by `public.platform_admins`, which is
**empty by default and never auto-populated**. This is deliberate: platform
admin sees data across every workspace, so nobody should get it by accident.

To grant it, run in the Supabase SQL editor (get the user's id from
`auth.users` by email first):

```sql
insert into public.platform_admins(user_id)
values ('00000000-0000-0000-0000-000000000000');
```

To revoke:

```sql
delete from public.platform_admins where user_id = '00000000-0000-0000-0000-000000000000';
```

There is intentionally no in-app UI to grant this — it's a break-glass
operation for Picbo staff, not a workspace-level permission.
