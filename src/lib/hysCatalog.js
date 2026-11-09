export const HYS_SECTIONS = [
  { code: 'legal', number: '01', label: 'Legajo legal', categories: ['Documentación legal', 'Organización preventiva'] },
  { code: 'visits', number: '02', label: 'Visitas', categories: ['Registros de visitas'] },
  { code: 'art', number: '03', label: 'ART', categories: ['03.01 Nómina y cláusulas de no repetición', '03.02 RGRL', '03.03 RAR', '03.04 Visitas e informes de ART', '03.06 Accidentes de trabajo', '03.07 Enfermedades profesionales', '03.08 Exámenes médicos laborales', '03.09 Capacitaciones ART', '03.10 Comunicaciones e intimaciones'] },
  { code: 'risks', number: '04', label: 'Identificación de peligros y evaluación de riesgos', categories: ['Mapa de riesgos', 'Matriz IPER / IPERC', 'Evaluaciones por puesto', 'ATS / AST'] },
  { code: 'inspections', number: '05', label: 'Inspecciones', categories: ['Checklists', 'Hallazgos'] },
  { code: 'reports', number: '06', label: 'Informes', categories: ['Investigaciones de accidentes e incidentes', 'Estadísticas de siniestralidad', 'Informe'] },
  { code: 'emergencies', number: '07', label: 'Emergencias', categories: ['Planes de emergencia', 'Simulacros', 'Incendios'] },
  { code: 'procedures', number: '08', label: 'Procedimientos', categories: ['PTS', 'LOTO', 'Permisos de trabajo', 'Instructivos', 'Control de versiones y documentos obsoletos'] },
  { code: 'training', number: '09', label: 'Capacitaciones', categories: ['Plan anual / Cronograma mensual', 'Registros de asistencia', 'Materiales de capacitación', 'Evaluación de eficacia', 'Certificados', 'Inducción del personal ingresante', 'Capacitación de contratistas', 'Indicadores de cumplimiento'] },
  { code: 'measurements', number: '10', label: 'Mediciones', categories: ['Res. SRT 84/12 – Iluminación', 'Res. SRT 85/12 – Ruido', 'Res. SRT 900/15 – Puesta a tierra', 'Res. SRT 886/15 – Ergonomía', 'Res. SRT 861/15 – Contaminantes químicos', 'Res. SRT 299/11 – Entrega de EPP', 'Res. SRT 801/15 – SGA', 'Otros protocolos y estudios'] },
  { code: 'contractors', number: '11', label: 'Contratistas', categories: ['Documentación y control de terceros'] },
  { code: 'actions', number: '12', label: 'Seguimiento y acciones correctivas', categories: ['Acciones correctivas y preventivas', 'Evidencias'] },
  { code: 'compliance', number: '13', label: 'Cumplimiento legal', categories: ['Ley 19.587 / Decreto 351/79', 'Decreto 911/96 – Construcción', 'Decreto 617/97 – Agro', 'Decreto 249/07 – Minería', 'Res. SRT 905/15 – Servicio de HyS', 'Res. SRT 61/23 – Trabajos en altura', 'Res. SRT 960/15 – Autoelevadores', 'Otros requisitos por actividad'] },
]

export const GENERAL_CATEGORIES = ['Legajo legal', 'ART y cobertura', 'Servicio de HyS', 'Plan anual de prevención', 'Procedimientos generales', 'Capacitaciones generales']
export const HYS_ALL_SECTIONS = [{ code: 'general', number: '00', label: 'Documentación general', categories: GENERAL_CATEGORIES }, ...HYS_SECTIONS]
export const HYS_STATES = { pendiente: 'Pendiente', en_curso: 'En curso', resuelta: 'Resuelta', verificada: 'Verificada' }
export const HYS_PRIORITIES = { baja: 'Baja', media: 'Media', alta: 'Alta', critica: 'Crítica' }
export const sectionLabel = (code) => HYS_ALL_SECTIONS.find((item) => item.code === code)?.label || code
