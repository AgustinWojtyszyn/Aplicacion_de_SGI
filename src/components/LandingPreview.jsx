import { BellRing, Check, FileText, GitBranch, LayoutDashboard, ShieldCheck } from 'lucide-react'

const modules = [
  { icon: LayoutDashboard, label: 'Resumen' },
  { icon: ShieldCheck, label: 'SGI / ISO' },
  { icon: FileText, label: 'Documentos' },
  { icon: BellRing, label: 'Alertas' },
]

// A schematic of existing modules, deliberately without fictional business data.
export default function LandingPreview() {
  return (
    <figure className="landing-preview" aria-label="Vista ilustrativa del sistema: resumen, documentos, cumplimiento y flujo de aprobación">
      <div className="landing-app-window" aria-hidden="true">
        <div className="landing-window-bar"><span className="landing-window-dots"><i /><i /><i /></span><span>gestiQa / SGI</span><ShieldCheck size={15} /></div>
        <div className="landing-window-body">
          <div className="landing-preview-sidebar">
            <span className="landing-preview-monogram">gestiQa<span> / SGI</span></span>
            {modules.map(({ icon: Icon, label }, index) => <div className={index === 0 ? 'is-active' : ''} key={label}><Icon size={17} /><span>{label}</span></div>)}
          </div>
          <div className="landing-preview-content">
            <div className="landing-preview-heading"><span>ESPACIO DE TRABAJO</span><strong>Resumen de gestión</strong><p>Tu documentación, conectada.</p></div>
            <div className="landing-preview-modules"><div><FileText size={19} /><strong>Documentos</strong><span>Seguimiento documental</span></div><div><ShieldCheck size={19} /><strong>Cumplimiento</strong><span>Requisitos ISO / SGI</span></div></div>
            <div className="landing-preview-flow"><div><GitBranch size={16} /><strong>Flujo documental</strong></div><ol><li><span>1</span>Borrador</li><li><span>2</span>En proceso</li><li><span><Check size={13} /></span>Aprobado</li></ol></div>
            <div className="landing-preview-bottom"><BellRing size={15} /><span>Revisiones y alertas en un mismo lugar</span></div>
          </div>
        </div>
      </div>
      <figcaption><span /> Vista ilustrativa de la plataforma</figcaption>
    </figure>
  )
}
