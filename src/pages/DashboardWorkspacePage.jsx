import { CheckCircle2, Circle, FileText, ShieldCheck, UsersRound } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import DashboardPage from './DashboardPage'
import { useAuth } from '../context/AuthContext'
import { listDocuments } from '../services/documentService'
import { listSgiRequirements } from '../services/sgiService'

export default function DashboardWorkspacePage() {
  const { company } = useAuth()
  const [documents, setDocuments] = useState([])
  const [requirements, setRequirements] = useState([])

  useEffect(() => {
    if (!company?.id) return
    Promise.all([
      listDocuments({ companyId: company.id }),
      listSgiRequirements(company.id),
    ]).then(([nextDocuments, nextRequirements]) => {
      setDocuments(nextDocuments)
      setRequirements(nextRequirements)
    }).catch((error) => console.error('No se pudo cargar el onboarding', error))
  }, [company?.id])

  const steps = useMemo(() => {
    const hasCompany = Boolean(company?.id && company?.name)
    const hasNorms = requirements.length > 0
    const hasOwners = documents.some((document) => document.responsible_id || document.reviewer_id || document.approver_id)
    const hasDocuments = documents.length > 0

    return [
      { label: 'Empresa configurada', detail: company?.name || 'Completar datos de la empresa', done: hasCompany, to: '/dashboard', icon: CheckCircle2 },
      { label: 'Normas y requisitos disponibles', detail: hasNorms ? `${requirements.length} requisitos listos para gestionar` : 'Revisar la estructura ISO / SGI', done: hasNorms, to: '/sgi', icon: ShieldCheck },
      { label: 'Responsables definidos', detail: hasOwners ? 'Ya existen responsables en el flujo documental' : 'Asignar responsables, revisores o aprobadores', done: hasOwners, to: '/documents', icon: UsersRound },
      { label: 'Primeros documentos cargados', detail: hasDocuments ? `${documents.length} documento${documents.length === 1 ? '' : 's'} cargado${documents.length === 1 ? '' : 's'}` : 'Cargar la primera evidencia del sistema', done: hasDocuments, to: '/documents', icon: FileText },
    ]
  }, [company, documents, requirements])

  const completed = steps.filter((step) => step.done).length
  const percent = Math.round((completed / steps.length) * 100)

  return (
    <>
      {percent < 100 && (
        <section className="onboarding-card" aria-label="Puesta en marcha de la empresa">
          <div className="onboarding-heading">
            <div>
              <span>PUESTA EN MARCHA</span>
              <h2>Prepará el espacio de {company?.name || 'la empresa'}</h2>
              <p>La guía se completa automáticamente a medida que configurás el SGI.</p>
            </div>
            <div className="onboarding-progress-copy"><strong>{percent}%</strong><span>{completed}/{steps.length} pasos</span></div>
          </div>
          <div className="onboarding-progress"><span style={{ width: `${percent}%` }} /></div>
          <div className="onboarding-steps">
            {steps.map(({ label, detail, done, to, icon: Icon }) => (
              <Link key={label} to={to} className={`onboarding-step ${done ? 'done' : ''}`}>
                <div className="onboarding-step-icon">{done ? <CheckCircle2 size={18} /> : <Circle size={18} />}</div>
                <div><strong>{label}</strong><span>{detail}</span></div>
                <Icon size={18} />
              </Link>
            ))}
          </div>
        </section>
      )}
      <DashboardPage />
    </>
  )
}
