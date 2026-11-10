// Local-only PostgreSQL/WASM test. Install @electric-sql/pglite in a temporary
// directory, then set HYS_PGLITE_MODULE to its dist/index.js absolute path.
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
const { PGlite } = await import(process.env.HYS_PGLITE_MODULE || '@electric-sql/pglite')
const db = new PGlite()
const read = name => readFileSync(new URL('../supabase/migrations/' + name, import.meta.url), 'utf8')
const base = read('20261109100000_hys_module.sql')
const ids = Array.from({length: 8}, (_, i) => `00000000-0000-0000-0000-${String(i + 1).padStart(12, '0')}`)
const [company, other, north, south, foreignUnit, admin, reader, editor] = ids
await db.exec(`
create role authenticated; create role anon;
create schema auth;
create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.uid', true),'')::uuid $$;
grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
create type public.company_role as enum ('admin','member');
create table companies(id uuid primary key);
create table profiles(id uuid primary key);
create table company_members(company_id uuid, user_id uuid, role company_role, is_active boolean);
create function public.has_company_role(c uuid, roles company_role[]) returns boolean language sql security definer as $$
 select exists(select 1 from public.company_members where company_id=c and user_id=auth.uid() and is_active and role=any(roles)) $$;
create function public.hys_is_member(c uuid) returns boolean language sql security definer as $$
 select exists(select 1 from public.company_members where company_id=c and user_id=auth.uid() and is_active) $$;
`)
// Use the repository's exact units, grants and authorization function definitions.
await db.exec(base.slice(base.indexOf('create table public.hys_units'), base.indexOf('create function public.hys_unit_visible')))
await db.exec(`create table hys_records(id uuid primary key default gen_random_uuid(), company_id uuid, unit_id uuid, section text, category text, title text);
 alter table hys_records enable row level security;
 create policy r on hys_records for select to authenticated using(hys_can(company_id,section,unit_id,false));
 create policy i on hys_records for insert to authenticated with check(hys_can(company_id,section,unit_id,true));
 create policy u on hys_records for update to authenticated using(hys_can(company_id,section,unit_id,true)) with check(hys_can(company_id,section,unit_id,true));
 grant select,insert,update on hys_records to authenticated;
 grant select on hys_units to authenticated;
 insert into companies values ('${company}'),('${other}');
 insert into profiles values ('${admin}'),('${reader}'),('${editor}');
 insert into company_members values ('${company}','${admin}','admin',true),('${company}','${reader}','member',true),('${company}','${editor}','member',true);
 insert into hys_units(id,company_id,name) values ('${north}','${company}','Norte'),('${south}','${company}','Sur'),('${foreignUnit}','${other}','Ajena');
 insert into hys_grants(company_id,user_id,unit_id,section,permission,granted_by) values
 ('${company}','${reader}','${north}','legal','read','${admin}'),('${company}','${editor}','${north}','legal','edit','${admin}');`)
await db.exec(read('20261109133000_hys_folders_crud.sql'))
await db.exec(read('20261109170000_hys_unit_sections_crud.sql'))
await db.exec(read('20261110211912_hys_folder_delete_guard.sql'))
await db.exec(read('20261110211912_hys_folder_delete_guard.sql')) // idempotence
const asUser = async user => db.exec(`reset role; select set_config('test.uid','${user}',false); set role authenticated;`)
const query = async (sql, params=[]) => (await db.query(sql, params)).rows
const create = async (c,u,s,parent,name) => (await query('select * from hys_create_folder($1,$2,$3,$4,$5)',[c,u,s,parent,name]))[0]
const reject = async (sql, params=[]) => assert.rejects(query(sql,params))
await asUser(admin)
const folder = await create(company,north,'legal',null,'Inducción')
await create(company,south,'legal',null,'Inducción')
await create(company,north,'training',null,'Inducción')
await create(company,north,'legal','Inducción','Anexo')
await query('insert into hys_records(company_id,unit_id,section,category,title) values ($1,$2,$3,$4,$5)',[company,north,'legal','Inducción / Anexo','Documento preservado'])
await query('select hys_update_folder($1,null,$2)',[folder.id,'Capacitación'])
assert.equal((await query('select category from hys_records'))[0].category,'Capacitación / Anexo')
assert.equal((await query('select count(*)::int n from hys_folders where category=$1',['Inducción']))[0].n,2)
await reject('select hys_delete_folder($1)',[folder.id])
await reject('delete from hys_folders where id=$1',[folder.id])
const empty = await create(company,north,'legal',null,'Temporal')
await query('select hys_delete_folder($1)',[empty.id])
await reject('select hys_create_folder($1,$2,$3,null,$4)',[company,foreignUnit,'legal','Inválida'])
await reject('select hys_create_folder($1,$2,$3,null,$4)',[other,foreignUnit,'legal','Sin permiso'])
await asUser(reader)
assert.equal((await query('select count(*)::int n from hys_folders'))[0].n,2)
await reject('select hys_create_folder($1,$2,$3,null,$4)',[company,north,'legal','Lectura'])
await reject('select hys_update_folder($1,null,$2)',[folder.id,'Prohibido'])
await reject('select hys_delete_folder($1)',[folder.id])
await asUser(editor)
await create(company,north,'legal',null,'Permitida')
await reject('select hys_create_folder($1,$2,$3,null,$4)',[company,south,'legal','Otra sede'])
await reject('select hys_create_folder($1,$2,$3,null,$4)',[company,north,'training','Otro apartado'])
await db.exec(`reset role; update company_members set is_active=false where user_id='${editor}'; set role authenticated;`)
assert.equal((await query('select count(*)::int n from hys_folders'))[0].n,0)
await db.exec('reset role; set role anon;')
await reject('select * from hys_folders')
console.log('PASS: CRUD, nested document preservation, delete protection (RPC/direct), company/site/section isolation, read/edit/inactive/anon roles, composite FK, migration idempotence. Local PostgreSQL WASM; no remote database accessed.')
await db.close()
