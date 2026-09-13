-- Picbo.ai Phase 28: storage.objects RLS was checking `auth.uid() is not null`
-- for insert/update/delete on the picbo-assets bucket — i.e. ANY authenticated
-- user, from ANY workspace, could overwrite or delete ANY other workspace's
-- files. Only the read policy was actually workspace-scoped. Found this by
-- reading the policies side by side while auditing storage (§33/§35) — a
-- textbook example of why every operation needs to be checked, not just SELECT.
--
-- Fix: paths are already `{workspace_id}/{asset_id}/{uuid}-{filename}`
-- (see lib/storage.ts safeAssetPath), so we can check workspace membership/role
-- directly from the path's first segment — cheaper and more robust than
-- joining against `assets`, and it works even mid-upload before any DB row
-- might exist for a given path.

drop policy if exists "picbo asset objects upload" on storage.objects;
drop policy if exists "picbo asset objects update" on storage.objects;
drop policy if exists "picbo asset objects delete" on storage.objects;

create policy "picbo asset objects upload" on storage.objects for insert with check (
  bucket_id='picbo-assets'
  and public.has_workspace_role((storage.foldername(name))[1]::uuid,array['owner','admin','manager','editor']::public.workspace_role[])
);
create policy "picbo asset objects update" on storage.objects for update using (
  bucket_id='picbo-assets'
  and public.has_workspace_role((storage.foldername(name))[1]::uuid,array['owner','admin','manager','editor']::public.workspace_role[])
);
create policy "picbo asset objects delete" on storage.objects for delete using (
  bucket_id='picbo-assets'
  and public.has_workspace_role((storage.foldername(name))[1]::uuid,array['owner','admin','manager','editor']::public.workspace_role[])
);

-- render-outputs never got any storage.objects policy at all (so it was
-- fully inaccessible to authenticated users — not a security hole, but it
-- means signed download URLs generated via the regular client would fail).
-- Reads are workspace-scoped by path prefix, same convention as above.
-- Writes are intentionally left to the service-role render worker only
-- (see lib/render/storage.ts) — no insert/update/delete policy for
-- authenticated users, since end users never write render output directly.
create policy "render output objects read" on storage.objects for select using (
  bucket_id='render-outputs'
  and public.is_workspace_member((storage.foldername(name))[1]::uuid)
);
