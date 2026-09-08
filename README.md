# SF Higiene · Plataforma SGI

Plataforma web interna para centralizar la **gestión documental de SF Higiene** y construir sobre una base segura el futuro Sistema de Gestión Integrado.

> Estado actual: **Etapa 1 · Base de plataforma + Gestión Documental**.

## Qué incluye esta etapa

- Inicio de sesión privado.
- Empresa, perfiles, roles, módulos y responsables.
- Carga de PDF, Word, Excel e imágenes.
- Documentos con título, descripción, tipo, norma, módulo y responsable.
- Flujo `Borrador → En proceso → Aprobado`.
- Observaciones internas.
- Historial de actividad documental.
- Búsqueda y filtros por estado, módulo, norma, tipo y fecha.
- Apertura segura de archivos mediante URLs firmadas.
- Dashboard con documentos por estado y pendientes principales.
- Supabase RLS y Storage privado.
- Diseño responsive.

## Arquitectura

```text
Usuario
   │
   ▼
React + Vite
   │
   ├──────── Supabase Auth
   │
   └──────── Supabase
               ├── PostgreSQL + RLS
               └── Storage privado
```

La aplicación **no utiliza una `service_role` en el navegador**. La autorización se resuelve en base de datos mediante RLS y funciones controladas.

## Stack

- React 18
- Vite 5
- React Router 6
- Supabase JS
- Supabase Auth
- PostgreSQL
- Supabase Storage
- Lucide React
- Vitest + Testing Library
- GitHub Actions
- Render

## Estados documentales

| Estado | Uso en Etapa 1 |
| --- | --- |
| Borrador | Documento en elaboración. Permite modificar metadata y agregar observaciones. |
| En proceso | Documento en seguimiento o pendiente de validación. |
| Aprobado | Documento vigente. La metadata queda bloqueada para edición. |

El flujo formal de revisión/aprobación por roles separados y el control de versiones pertenecen a **Etapa 2**.

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

Las migraciones se encuentran en `supabase/migrations/`.

Aplicarlas en orden antes de usar la aplicación contra un proyecto Supabase nuevo.

La primera sesión autenticada puede inicializar al primer administrador de SF Higiene. El bootstrap deja de conceder acceso automáticamente después de crear el primer miembro de la empresa.

Más detalles: [`docs/SETUP.md`](docs/SETUP.md).

## Tests y build

```bash
npm run test:run
npm run build
```

GitHub Actions ejecuta ambas verificaciones en los pushes y pull requests contra `main`.

## Deploy

El repositorio incluye `render.yaml` para un deploy estático de Vite en Render. Configurar allí las dos variables `VITE_*` de Supabase.

## Alcance contractual de Etapa 1

Los criterios de aceptación están documentados en [`docs/STAGE1_ACCEPTANCE.md`](docs/STAGE1_ACCEPTANCE.md).

### Próxima etapa

Etapa 2 incorporará SGI completo, ISO 9001 / 14001 / 45001, estructura por capítulos, control formal de versiones, revisiones, aprobaciones, alertas y métricas de cumplimiento.

---

**SF Higiene · Sistema de Gestión**  
Desarrollo por etapas · 2026
