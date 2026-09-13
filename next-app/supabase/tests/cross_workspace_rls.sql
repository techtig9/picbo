\set ON_ERROR_STOP off
\pset pager off
\pset format aligned
\pset tuples_only off

-- ===== Setup: two real users signing up (triggers fire naturally) =====
insert into auth.users(id,email) values
  ('11111111-1111-1111-1111-111111111111','alice@a.test'),
  ('22222222-2222-2222-2222-222222222222','bob@b.test');

select id as alice_ws from public.workspaces where owner_id='11111111-1111-1111-1111-111111111111' \gset
select id as bob_ws from public.workspaces where owner_id='22222222-2222-2222-2222-222222222222' \gset

\echo '--- Workspace IDs captured ---'
\echo 'alice_ws:' :alice_ws
\echo 'bob_ws:' :bob_ws

-- Seed data as postgres (superuser, bypasses RLS — this is trusted setup, not a test)
insert into public.products(id,workspace_id,name,created_by)
values ('33333333-3333-3333-3333-333333333333',:'alice_ws','Alice Product','11111111-1111-1111-1111-111111111111'),
       ('44444444-4444-4444-4444-444444444444',:'bob_ws','Bob Product','22222222-2222-2222-2222-222222222222');

insert into public.credit_ledger(workspace_id,type,amount,idempotency_key) values (:'alice_ws','grant',100,'seed-alice');

insert into public.ai_jobs(id,workspace_id,created_by,task,status,idempotency_key)
values('66666666-6666-6666-6666-666666666666',:'alice_ws','11111111-1111-1111-1111-111111111111','chat','running','seed-job-1');

insert into storage.buckets(id,name,public) values('picbo-assets','picbo-assets',false) on conflict do nothing;
insert into public.assets(id,workspace_id,kind,status,storage_path,created_by)
values('77777777-7777-7777-7777-777777777777',:'bob_ws','product_reference','ready',:'bob_ws' || '/some-asset/file.jpg','22222222-2222-2222-2222-222222222222');
insert into storage.objects(bucket_id,name) values('picbo-assets',:'bob_ws' || '/some-asset/file.jpg');

\echo ''
\echo '===== RUNNING TESTS AS AUTHENTICATED (non-superuser) ROLE ====='

\echo '=== TEST 1: Alice SELECTs her own product (EXPECT 1) ==='
set app.current_user_id = '11111111-1111-1111-1111-111111111111';
set role authenticated;
select count(*) as result from public.products where id='33333333-3333-3333-3333-333333333333';
reset role;

\echo '=== TEST 2: Alice CANNOT see Bobs product cross-workspace (EXPECT 0) ==='
set role authenticated;
select count(*) as result from public.products where id='44444444-4444-4444-4444-444444444444';
reset role;

\echo '=== TEST 3: Alice CANNOT UPDATE Bobs product (EXPECT UPDATE 0, name unchanged) ==='
set role authenticated;
update public.products set name='HACKED' where id='44444444-4444-4444-4444-444444444444';
reset role;
select name as result from public.products where id='44444444-4444-4444-4444-444444444444';

\echo '=== TEST 4: Alice CANNOT DELETE Bobs product (EXPECT DELETE 0, row survives) ==='
set role authenticated;
delete from public.products where id='44444444-4444-4444-4444-444444444444';
reset role;
select count(*) as result from public.products where id='44444444-4444-4444-4444-444444444444';

\echo '=== TEST 5: Alice CANNOT INSERT into Bobs workspace (EXPECT RLS ERROR) ==='
set role authenticated;
insert into public.products(workspace_id,name,created_by) values(:'bob_ws','Injected','11111111-1111-1111-1111-111111111111');
reset role;

\echo '=== TEST 6: Alice sees own credit_ledger, not Bobs (EXPECT 1 then 0) ==='
set role authenticated;
select count(*) as result from public.credit_ledger where workspace_id=:'alice_ws';
select count(*) as result from public.credit_ledger where workspace_id=:'bob_ws';
reset role;

\echo '=== TEST 7: Alice cannot reserve_credits against Bobs workspace (EXPECT NOT_A_MEMBER error) ==='
set role authenticated;
select public.reserve_credits(:'bob_ws'::uuid,5,'attack-1',null);
reset role;

\echo '=== TEST 8: Alice CANNOT delete Bobs storage object (EXPECT DELETE 0, survives) ==='
set role authenticated;
delete from storage.objects where name=:'bob_ws' || '/some-asset/file.jpg';
reset role;
select count(*) as result from storage.objects where name=:'bob_ws' || '/some-asset/file.jpg';

\echo '=== TEST 9: Bob CAN delete his own storage object (EXPECT DELETE 1, gone) ==='
set app.current_user_id = '22222222-2222-2222-2222-222222222222';
set role authenticated;
delete from storage.objects where name=:'bob_ws' || '/some-asset/file.jpg';
reset role;
select count(*) as result from storage.objects where name=:'bob_ws' || '/some-asset/file.jpg';

\echo '=== TEST 10: A user with no workspace membership sees neither product (EXPECT 0) ==='
insert into auth.users(id,email) values('55555555-5555-5555-5555-555555555555','outsider@c.test');
delete from public.workspace_members where user_id='55555555-5555-5555-5555-555555555555';
set app.current_user_id = '55555555-5555-5555-5555-555555555555';
set role authenticated;
select count(*) as result from public.products where id in ('33333333-3333-3333-3333-333333333333','44444444-4444-4444-4444-444444444444');
reset role;

\echo '=== TEST 11: is_platform_admin() is false for a regular, non-granted user (EXPECT f) ==='
set app.current_user_id = '11111111-1111-1111-1111-111111111111';
set role authenticated;
select public.is_platform_admin('11111111-1111-1111-1111-111111111111'::uuid) as result;
reset role;

\echo '=== TEST 12: is_platform_admin() is TRUE once explicitly granted (EXPECT t) ==='
insert into public.platform_admins(user_id) values('11111111-1111-1111-1111-111111111111');
set role authenticated;
select public.is_platform_admin('11111111-1111-1111-1111-111111111111'::uuid) as result;
reset role;

\echo '=== TEST 13: ai_job_attempts INSERT works for the jobs workspace editor — the Phase 2 bug fix (EXPECT 1 row) ==='
set role authenticated;
insert into public.ai_job_attempts(job_id,provider,model,attempt_no,status) values('66666666-6666-6666-6666-666666666666','groq','test-model',1,'succeeded');
reset role;
select count(*) as result from public.ai_job_attempts where job_id='66666666-6666-6666-6666-666666666666';

\echo '=== TEST 14: Bob CANNOT insert an attempt against Alices job (EXPECT RLS ERROR) ==='
set app.current_user_id = '22222222-2222-2222-2222-222222222222';
set role authenticated;
insert into public.ai_job_attempts(job_id,provider,model,attempt_no,status) values('66666666-6666-6666-6666-666666666666','groq','test-model',2,'succeeded');
reset role;

\echo ''
\echo '===== DONE ====='
