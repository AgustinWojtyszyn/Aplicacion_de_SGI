# Criterios de aceptación · Etapa 1

Este documento separa explícitamente lo comprometido en la primera entrega de las funciones de la Etapa 2.

## Base de plataforma

- [x] Proyecto React + Vite.
- [x] Interfaz responsive desktop / móvil.
- [x] Supabase Auth.
- [x] Sesiones persistentes y rutas protegidas.
- [x] Empresa SF Higiene.
- [x] Roles `admin`, `responsible` y `member`.
- [x] Módulos iniciales.
- [x] PostgreSQL + RLS.
- [x] Storage privado con políticas por empresa.

## Usuarios y acceso

- [x] Panel de usuarios exclusivo para administradores.
- [x] Invitación de usuarios por correo mediante Edge Function segura.
- [x] Asignación y cambio de rol.
- [x] Activación / desactivación de acceso.
- [x] Protección para conservar al menos un administrador activo.
- [x] Primera contraseña desde enlace de invitación.
- [x] Recuperación de contraseña desde Login.
- [x] Ruta de administración protegida además de ocultarse en la navegación.
- [x] Acciones documentales visibles según rol, autor y responsable.

## Gestión documental

- [x] Alta de documentos.
- [x] PDF.
- [x] Word (`.doc`, `.docx`).
- [x] Excel (`.xls`, `.xlsx`).
- [x] Imágenes JPG / PNG / WEBP.
- [x] Límite de 25 MB por archivo.
- [x] Título y descripción.
- [x] Tipo de documento.
- [x] Clasificación / norma.
- [x] Módulo.
- [x] Responsable.
- [x] Estado `Borrador → En proceso → Aprobado`.
- [x] Edición de metadata mientras el documento no esté aprobado.
- [x] Documento aprobado bloqueado para edición de metadata.
- [x] Observaciones internas.
- [x] Historial de creación, cambios de estado, responsable y metadata.
- [x] Apertura segura mediante URL firmada.

## Búsqueda y seguimiento

- [x] Búsqueda por título, descripción o nombre de archivo.
- [x] Filtro por estado.
- [x] Filtro por módulo.
- [x] Filtro por norma.
- [x] Filtro por tipo.
- [x] Filtro por rango de fechas.
- [x] Dashboard con total por estado.
- [x] Pendientes principales.
- [x] Pendientes asignados al usuario.
- [x] Documentos recientes.

## Seguridad e integridad

- [x] No se incluye `service_role` en frontend.
- [x] Acceso a documentos protegido por RLS.
- [x] Bucket no público.
- [x] Responsable debe pertenecer a la misma empresa.
- [x] Módulo debe pertenecer a la misma empresa.
- [x] `company_id`, `created_by` y `file_path` no pueden cambiar una vez creado el documento.
- [x] Primer administrador con bootstrap de uso único.
- [x] Usuarios desactivados dejan de contar como miembros válidos para RLS.

## Calidad

- [x] Tests básicos de componentes y validación de archivos.
- [x] Tests de capacidades por rol.
- [x] Validación de roles antes de operaciones de usuarios.
- [x] Build de producción automatizado en CI.
- [x] Tests automatizados en CI.
- [x] Configuración de Render preparada.
- [x] Instrucciones de setup documentadas.

---

# No incluido todavía · Etapa 2

Estas funciones deben incorporarse en la etapa SGI / ISO y no se consideran parte del cierre de Etapa 1:

- organización completa por capítulos y requisitos ISO 9001;
- organización completa por capítulos y requisitos ISO 14001;
- organización completa por capítulos y requisitos ISO 45001;
- módulo SGI integrado;
- control formal de versiones de un mismo documento;
- revisión y aprobación con roles separados;
- registro formal de creador / revisor / aprobador por versión;
- notificaciones automáticas por vencimiento o revisión;
- alertas de cumplimiento;
- KPI de tiempos de aprobación;
- dashboard de cumplimiento por norma;
- gestión de flota y mantenimiento vehicular.
