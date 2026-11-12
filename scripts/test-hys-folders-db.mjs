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
const bulkSql = readFileSync(new URL('../docs/sql/HYS_FOLDER_UPLOAD.sql', import.meta.url), 'utf8')
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
await db.exec(`
 create schema storage;
 create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
 create table storage.objects(bucket_id text, name text, metadata jsonb, primary key(bucket_id,name));
 alter table storage.objects enable row level security;
 grant usage on schema storage to authenticated, anon;
 grant select,insert on storage.objects to authenticated, anon;
`)
await db.exec(base.slice(base.indexOf('create table public.hys_actions ('), base.indexOf('alter table public.hys_units enable')))
await db.exec('alter table public.hys_records enable row level security')
await db.exec(base.slice(base.indexOf('create policy hys_records_read'), base.indexOf('grant select,insert,update on public.hys_units')))
await db.exec(`grant select,insert,update,delete on hys_records to authenticated;
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
await db.exec(bulkSql)
await db.exec(bulkSql)
const asUser = async user => db.exec(`reset role; select set_config('test.uid','${user}',false); set role authenticated;`)
const query = async (sql, params=[]) => (await db.query(sql, params)).rows
const create = async (c,u,s,parent,name) => (await query('select * from hys_create_folder($1,$2,$3,$4,$5)',[c,u,s,parent,name]))[0]
const reject = async (sql, params=[]) => assert.rejects(query(sql,params))
await asUser(admin)
const folder = await create(company,north,'legal',null,'Inducción')
const southFolder = await create(company,south,'legal',null,'Inducción')
await create(company,north,'training',null,'Inducción')
await create(company,north,'legal','Inducción','Anexo')
await query('insert into hys_records(company_id,unit_id,section,category,title,created_by) values ($1,$2,$3,$4,$5,$6)',[company,north,'legal','Inducción / Anexo','Documento preservado',admin])
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
const bulkFolder = await create(company,north,'legal','Capacitación','Lote')
const bulkId = '10000000-0000-0000-0000-000000000001'
const badId = '10000000-0000-0000-0000-000000000002'
const path = (id, c = company) => `${c}/${id}/archivo`
const reserveSql = `insert into hys_folder_uploads(id,folder_id,category,file_name,file_size,file_path)
  values ($1,$2,$3,$4,$5,$6) on conflict(id) do nothing`
const reserve = (id, target, name, size, filePath = path(id)) =>
  query(reserveSql, [id, target.id, target.category, name, size, filePath])
const finish = async (id = bulkId, name = 'Capacitación.mp4', size = 31457280) =>
  (await query('select hys_finish_folder_upload($1,$2,$3,$4,$5) as ok',
    [id, bulkFolder.id, bulkFolder.category, name, size]))[0].ok
const store = (filePath, size) => query("insert into storage.objects values ('hys-files',$1,jsonb_build_object('size',$2::bigint))", [filePath, size])
await db.exec(`reset role; insert into hys_folders (company_id,unit_id,section,name,category,created_by)
  values ('${other}','${foreignUnit}','legal','Ajena','Ajena','${admin}');`)
const [foreignFolder] = await query("select * from hys_folders where company_id=$1", [other])
await asUser(reader)
await assert.rejects(reserve(bulkId, bulkFolder, 'Capacitación.mp4', 31457280))
await assert.rejects(finish())
await assert.rejects(store(path(bulkId), 31457280))
await asUser(editor)
await assert.rejects(reserve(bulkId, southFolder, 'Capacitación.mp4', 31457280))
await assert.rejects(reserve(bulkId, foreignFolder, 'Capacitación.mp4', 31457280, path(bulkId, other)))
await assert.rejects(reserve(bulkId, bulkFolder, '../Lista.pdf', 8))
await assert.rejects(reserve(bulkId, bulkFolder, 'Lista.exe', 8))
await assert.rejects(reserve(bulkId, bulkFolder, 'Lista.pdf', 26214401))
await assert.rejects(reserve(bulkId, bulkFolder, 'Lista.pdf', 8, path(bulkId, other)))
await reserve(bulkId, bulkFolder, 'Capacitación.mp4', 31457280)
await reserve(bulkId, bulkFolder, 'Capacitación.mp4', 31457280) // Same reservation, no update.
assert.equal(await finish(), false)
assert.equal((await query('select count(*)::int n from hys_records where id=$1', [bulkId]))[0].n, 0)
await assert.rejects(store(path(badId), 31457280))
await store(path(bulkId), 31457280)
await asUser(reader)
assert.equal((await query('select * from storage.objects')).length, 0)
await asUser(admin)
assert.equal((await query('select * from storage.objects')).length, 0)
await asUser(editor)
assert.equal(await finish(), true)
await reserve(bulkId, bulkFolder, 'Capacitación.mp4', 31457280)
assert.equal(await finish(), true)
assert.equal((await query('select * from hys_folder_uploads')).length, 0)
await reserve(badId, bulkFolder, 'CAPACITACIÓN.mp4', 31457280)
await assert.rejects(finish(badId, 'CAPACITACIÓN.mp4', 31457280), /Ya existe/)
const individualId = '10000000-0000-0000-0000-000000000003'
const individualPath = path(individualId).replace('/archivo', '/original.pdf')
await query(`insert into hys_records (id,company_id,unit_id,section,category,title,created_by,file_name,file_size,file_path)
  values ($1,$2,$3,'legal','Capacitación','Individual',$4,'original.pdf',10,$5)`,
[individualId, company, north, editor, individualPath])
await store(individualPath, 10)
await asUser(reader)
assert.equal((await query('select * from hys_records')).length, 3)
assert.equal((await query('select * from storage.objects')).length, 2)
assert.equal((await query('select title from hys_records where file_path is null'))[0].title, 'Documento preservado')
await db.exec('reset role; set role anon;')
assert.equal((await query('select * from storage.objects')).length, 0)
await assert.rejects(finish())
await asUser(editor)
await db.exec(`reset role; update company_members set is_active=false where user_id='${editor}'; set role authenticated;`)
assert.equal((await query('select count(*)::int n from hys_folders'))[0].n,0)
await db.exec('reset role; set role anon;')
await reject('select * from hys_folders')
console.log('PASS: CRUD, nested document preservation, delete protection (RPC/direct), company/site/section isolation, read/edit/inactive/anon roles, composite FK, migration idempotence, private staged objects, duplicate rejection, interrupted upload, successful replay and individual uploads. Local PostgreSQL WASM; no remote database accessed.')
await db.close()
