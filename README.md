# EP Consultora

**Gestión documental, SGI, cumplimiento y trazabilidad en un solo flujo.**

EP Consultora es una plataforma web multiempresa para centralizar documentación, responsables, versiones, revisiones, aprobaciones, requisitos ISO y alertas dentro de un Sistema de Gestión Integrado.

> Estado actual: **casi listo para producción**. La base operativa y la mayor parte del flujo SGI/ISO ya están implementados.

## Funcionalidades principales

- Acceso multiempresa con espacios aislados por cliente.
- Registro público asociado a una empresa con habilitación administrativa posterior.
- Alta de empresas desde administración global con invitación automática del primer administrador.
- Autenticación y recuperación de contraseña con Supabase Auth.
- Roles `admin`, `responsible` y `member` dentro de cada empresa.
- Administradores globales de EP Consultora separados de los administradores de clientes.
- Gestión documental con PDF, Word, Excel e imágenes.
- Estados `Borrador → En revisión → Aprobado`.
- Revisor y aprobador designados.
- Control formal de versiones de archivos.
- Historial de actividad y trazabilidad.
- Comentarios y observaciones internas.
- Fechas objetivo de revisión y documentos vencidos.
- Centro de alertas internas.
- Dashboard SGI con cobertura, pendientes y métricas.
- Estructura ISO 9001, ISO 14001, ISO 45001 y SGI Integrado.
- Capítulos 4 a 10 y asociación documental a requisitos.
- Búsqueda y filtros.
- Storage privado con URLs firmadas.
- RLS en PostgreSQL para proteger información por empresa, membresía y rol.
- Panel administrativo de usuarios.

## Flujo documental

```text
Borrador
   │
   ├── nueva versión
   ├── responsable
   └── requisito ISO
   │
   ▼
En revisión
   │
   ├── revisor
   ├── observaciones / devolución
   └── aprobador
   │
   ▼
Aprobado
```

Durante revisión y luego de la aprobación, la metadata sensible queda bloqueada para preservar la trazabilidad.

## Seguridad

- La aplicación no expone `service_role` en el navegador.
- Los documentos se almacenan en un bucket privado.
- El acceso se valida con RLS y funciones controladas en PostgreSQL.
- Una cuenta registrada no obtiene acceso a documentación hasta ser habilitada por un administrador.
- Los administradores de una empresa no obtienen permisos globales sobre otros clientes.
- Se protege al último administrador activo para evitar que un espacio de trabajo quede sin administración.

## Stack

- React 18
- Vite 5
- React Router 6
- Supabase JS / Auth / PostgreSQL / Storage / Edge Functions
- Lucide React
- Vitest + Testing Library
- GitHub Actions
- Render

## Desarrollo local

```bash
git clone https://github.com/AgustinWojtyszyn/Aplicacion_de_SGI.git
cd Aplicacion_de_SGI
npm install
cp .env.example .env
npm run dev
```

Variables requeridas:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

## Base de datos

Las migraciones viven en `supabase/migrations/` y deben aplicarse en orden. La guía actualizada está en [`docs/SETUP.md`](docs/SETUP.md).

## Tests y build

```bash
npm run test:run
npm run build
```

GitHub Actions ejecuta ambas verificaciones automáticamente en cada push a `main`.

## Estado funcional

El detalle de la implementación SGI está en [`docs/STAGE2_STATUS.md`](docs/STAGE2_STATUS.md).

Queda como mejora posterior el envío automático de emails para eventos del flujo documental. Las notificaciones internas y los recordatorios de vencimientos ya forman parte de la aplicación.

## Preparación para producción

Antes del deploy final, seguir [`docs/PRODUCTION_CHECKLIST.md`](docs/PRODUCTION_CHECKLIST.md).

---

**EP Consultora** · Gestión documental y procesos integrados · 2026
