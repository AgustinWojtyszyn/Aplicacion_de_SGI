# Cierre SGI gestiQa: registro y permisos

## Códigos de acceso

| Empresa | Código sencillo | Slug antiguo (sigue vigente) |
| --- | --- | --- |
| ANDES CALINGASTA SRL | andes | andes-calingasta-srl |
| GESTIQA | gestiqa | ep-consultora |
| INGETEC | ingetec | ingetec |
| Parque Fotovoltaico Cutral Có | cutral | parque-fotovoltaico-cutral-co |

La empresa de prueba inactiva no se puede resolver en login.

## Roles

- **Usuario (member)**: consulta documentos de su empresa. No crea, edita, elimina, aprueba ni recibe enlaces directos de descarga del bucket.
- **Responsable (responsible)**: lectura más revisión, aprobación, rechazo y observaciones únicamente en documentos a los que fue asignado.
- **Administrador de empresa (admin)**: gestión completa de documentación, ISO, trabajos y usuarios de su propia empresa.
- **Administrador global (platform_admins)**: administra todas las empresas y puede cambiar de espacio.

El código no concede acceso. El registro crea una membresía inactiva de tipo Usuario; el administrador debe habilitarla.

## Puesta en producción necesaria

El frontend no aplica migraciones SQL ni despliega funciones de Supabase.

1. Ejecutar una vez el SQL de supabase/migrations/20261030230000_final_tenant_roles_and_access_codes.sql en **el proyecto Supabase del SGI**, después de las migraciones anteriores.
2. Desplegar o actualizar las dos funciones en ese proyecto:
   - npx supabase functions deploy preview-document --project-ref TU_REF_SGI
   - npx supabase functions deploy smart-handler --project-ref TU_REF_SGI
3. Desplegar el frontend de main.
4. Verificar roles con sesiones de un Usuario, un Responsable asignado, un Administrador de empresa y un Administrador global. Intentar acceder a empresas ajenas por URL y API.
5. La vista previa autenticada admite PDF, PNG, JPG y WEBP; en Word y Excel solo aparecen metadatos hasta incorporar una conversión segura. Ningún software web puede impedir completamente copiar información después de entregarla al navegador.

## Comprobación SQL (solo lectura)

~~~sql
select name, slug, is_active from public.companies order by name;

select schemaname, tablename, policyname, cmd, qual, with_check
from pg_policies
where (schemaname = 'public' and tablename in (
  'documents', 'document_folders', 'document_comments',
  'work_entries', 'sgi_requirement_evaluations'
))
or (schemaname = 'storage' and tablename = 'objects')
order by schemaname, tablename, policyname;

select c.name, c.slug, count(cm.user_id) filter (where cm.is_active) as active_members
from public.companies c
left join public.company_members cm on cm.company_id = c.id
group by c.id, c.name, c.slug order by c.name;
~~~

**Seguridad:** auditar todas las políticas de storage.objects, incluidas las creadas manualmente fuera del repositorio; las políticas permisivas se combinan con OR.

## Conservación de datos

No se borraron usuarios, documentos ni asociaciones previas. Para cuentas no globales con múltiples membresías históricas, solo se habilita el acceso a su primera empresa activa. La empresa de prueba inactiva sigue almacenada y requiere su proceso de eliminación separado.
