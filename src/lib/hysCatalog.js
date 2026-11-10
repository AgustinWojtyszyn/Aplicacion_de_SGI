export const HYS_SECTIONS = [
  { code: 'legal', number: '01', label: 'Legajo legal', categories: ['Documentación legal y organización preventiva'] },
  { code: 'visits', number: '02', label: 'Visitas', categories: ['Registros de visitas'] },
  { code: 'art', number: '03', label: 'ART', categories: ['03.01 Nómina y cláusulas de no repetición', '03.02 RGRL', '03.03 RAR', '03.04 Visitas e informes de ART', '03.06 Accidentes de trabajo', '03.07 Enfermedades profesionales', '03.08 Exámenes médicos laborales', '03.09 Capacitaciones ART', '03.10 Comunicaciones e intimaciones'] },
  { code: 'risks', number: '04', label: 'Identificación de peligros y evaluación de riesgos', categories: ['Mapa de riesgos', 'Matriz IPER / IPERC', 'Evaluaciones por puesto', 'ATS / AST'] },
  { code: 'inspections', number: '05', label: 'Inspecciones', categories: ['Checklists y hallazgos'] },
  { code: 'reports', number: '06', label: 'Informes', categories: ['Investigaciones de accidentes e incidentes', 'Estadísticas de siniestralidad', 'Informe'] },
  { code: 'emergencies', number: '07', label: 'Emergencias', categories: ['Planes, simulacros e incendios'] },
  { code: 'procedures', number: '08', label: 'Procedimientos', categories: ['PTS, LOTO, permisos e instructivos', 'Control de versiones y documentos obsoletos'] },
  { code: 'training', number: '09', label: 'Capacitaciones', categories: ['Plan anual / Cronograma mensual', 'Registros de asistencia', 'Materiales de capacitación', 'Evaluación de eficacia', 'Certificados', 'Inducción del personal ingresante', 'Capacitación de contratistas', 'Indicadores de cumplimiento'] },
  { code: 'measurements', number: '10', label: 'Mediciones', categories: ['Res. SRT 84/12 – Iluminación', 'Res. SRT 85/12 – Ruido', 'Res. SRT 900/15 – Puesta a tierra', 'Res. SRT 886/15 – Ergonomía', 'Res. SRT 861/15 – Contaminantes químicos', 'Res. SRT 299/11 – Entrega de EPP', 'Res. SRT 801/15 – SGA', 'Otros protocolos y estudios'] },
  { code: 'contractors', number: '11', label: 'Contratistas', categories: ['Documentación y control de terceros'] },
  { code: 'actions', number: '12', label: 'Seguimiento y acciones correctivas', categories: ['Acciones correctivas y preventivas'] },
  { code: 'compliance', number: '13', label: 'Cumplimiento legal', categories: ['Ley 19.587 / Decreto 351/79', 'Decreto 911/96 – Construcción', 'Decreto 617/97 – Agro', 'Decreto 249/07 – Minería', 'Res. SRT 905/15 – Servicio de HyS', 'Res. SRT 61/23 – Trabajos en altura', 'Res. SRT 960/15 – Autoelevadores', 'Otros requisitos por actividad'] },
]

export const GENERAL_CATEGORIES = ['Legajo legal', 'ART y cobertura', 'Servicio de HyS', 'Plan anual de prevención', 'Procedimientos generales', 'Capacitaciones generales']
export const HYS_ALL_SECTIONS = [{ code: 'general', number: '00', label: 'Documentación general', categories: GENERAL_CATEGORIES }, ...HYS_SECTIONS]
export const HYS_STATES = { pendiente: 'Pendiente', en_curso: 'En curso', resuelta: 'Resuelta', verificada: 'Verificada' }
export const HYS_PRIORITIES = { baja: 'Baja', media: 'Media', alta: 'Alta', critica: 'Crítica' }
export const sectionLabel = (code) => HYS_ALL_SECTIONS.find((item) => item.code === code)?.label || code

/** All subapartados stay visible when empty, including legacy categories from saved documents. */
export function hysSectionFolders(section, records = []) {
  const known = section?.categories || []
  const extra = [...new Set(records.map((record) => record.category)
    .filter((category) => category && !known.includes(category)))]
  return [...known, ...extra].map((name) => ({
    name,
    count: records.filter((record) => record.category === name).length,
  }))
}

// The company matrix shares section numbering with establishments. Documents keep
// their existing general scope and permissions, including older ungrouped files.
const generalTopics = {
  legal: ['Documentación legal y organización preventiva'],
  art: ['03.01 Nómina y cláusulas de no repetición', '03.02 RGRL – Relevamiento General de Riesgos Laborales', '03.03 RAR – Relevamiento de Agentes de Riesgo', '03.04 Visitas e informes de ART', '03.06 Accidentes de trabajo', '03.07 Enfermedades profesionales', '03.08 Exámenes médicos laborales', '03.09 Capacitaciones de ART – materiales, asistencia y certificados', '03.10 Comunicaciones e intimaciones'],
  risks: ['Mapa de riesgos', 'Matriz IPER / IPERC', 'Evaluaciones de riesgos por puesto', 'ATS / AST'],
  inspections: ['Checklists y hallazgos'],
  emergencies: ['Planes, simulacros e incendios'],
  procedures: ['PTS, LOTO, permisos e instructivos', 'Control de versiones y documentos obsoletos'],
  training: ['Plan anual de capacitación / Cronograma mensual', ...HYS_SECTIONS.find(s => s.code === 'training').categories.slice(1)],
  measurements: ['Res. SRT 84/12 – Iluminación', 'Res. SRT 85/12 – Ruido', 'Res. SRT 900/15 – Puesta a tierra y continuidad de masas', 'Res. SRT 886/15 – Ergonomía', 'Res. SRT 861/15 – Contaminantes químicos', 'Res. SRT 299/11 – Entrega de EPP', 'Res. SRT 801/15 – SGA', 'Otros protocolos y estudios específicos'],
  actions: ['Acciones correctivas y preventivas'],
  compliance: ['Industria y servicios – Ley 19.587 / Decreto 351/79', 'Construcción – Decreto 911/96', 'Agro – Decreto 617/97', 'Minería – Decreto 249/07', 'Funciones del Servicio de HyS – Res. SRT 905/15', 'Trabajos en altura en construcción – Res. SRT 61/23', 'Autoelevadores – Res. SRT 960/15', 'Otros requisitos aplicables según actividad'],
}

// These contents match the original matrix; avoid splitting prose into invented folders.
for (const section of HYS_SECTIONS) {
  if (generalTopics[section.code]) section.categories = generalTopics[section.code]
}

export const GENERAL_MATRIX = HYS_SECTIONS.map(section => ({
  ...section,
  label: section.code === 'legal' ? 'Documentación legal' : section.label,
  prefix: section.number + ' / ',
  categories: generalTopics[section.code] || section.categories,
}))

/** Per-establishment section overrides; no row means the original 13-section template. */
export function hysConfiguredSections(configurations = [], unitId, companyId) {
  const rows = (configurations || []).filter(row => row.unit_id === unitId && (companyId === undefined || row.company_id === companyId))
  const byCode = new Map(rows.map(row => [row.code, row]))
  const fixed = HYS_SECTIONS.map(item => {
    const override = byCode.get(item.code)
    // A renamed section is a user-defined topic, not an alias for the old template.
    // Keep its identity (and all existing records), but do not infer any new folders.
    const renamed = override?.label && override.label.trim() !== item.label
    return { ...item, label: override?.label || item.label,
      categories: renamed ? [] : item.categories,
      enabled: override?.is_active !== false, custom: false }
  })
  const custom = rows.filter(row => row.code.startsWith('custom_'))
    .map(row => ({ code: row.code, number: '+', label: row.label,
      categories: [], enabled: row.is_active, custom: true }))
  return [...fixed, ...custom]
}
