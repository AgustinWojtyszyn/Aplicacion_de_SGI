# SF Higiene · Plataforma SGI

Aplicación web interna para centralizar la gestión documental de **SF Higiene** y preparar la base técnica del futuro Sistema de Gestión Integrado (SGI).

## Etapa actual

**Etapa 1 · Base de plataforma + Gestión Documental**

Objetivo: entregar una primera versión funcional para trabajar con documentación controlada, responsables, estados y seguimiento.

### Alcance de Etapa 1

- Autenticación de usuarios.
- Estructura por empresa, módulos y responsables.
- Gestión documental interna.
- Carga de PDF, Word, Excel e imágenes.
- Estados `Borrador → En proceso → Aprobado`.
- Asignación de responsables y observaciones.
- Búsqueda y filtros por tipo, estado, fecha o norma.
- Descarga de documentos e historial de actividad.
- Dashboard inicial con documentos por estado y pendientes.
- Seguridad en base de datos mediante Supabase RLS.

### Fuera de Etapa 1

La organización completa por capítulos ISO 9001 / 14001 / 45001, control formal de versiones, circuito de revisión/aprobación, alertas automáticas y métricas de cumplimiento pertenecen a la Etapa 2.

## Stack

- React + Vite
- React Router
- Supabase Auth
- Supabase PostgreSQL
- Supabase Storage
- CSS responsive
- Vitest

## Estado

🚧 Desarrollo iniciado el 8 de septiembre de 2026.
