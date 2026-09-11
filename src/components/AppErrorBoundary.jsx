import { Component } from 'react'
import { Home, RefreshCw } from 'lucide-react'
import BrandLogo from './BrandLogo'

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('EP Consultora render error', error, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <main className="access-screen">
        <section className="access-card">
          <BrandLogo className="access-brand-logo" />
          <p className="eyebrow">RECUPERACIÓN DE PANTALLA</p>
          <h1>No pudimos mostrar esta sección.</h1>
          <p>
            La sesión sigue protegida. Podés recargar la aplicación o volver al acceso inicial para continuar.
          </p>
          <div className="access-actions">
            <button className="primary-button" type="button" onClick={() => window.location.reload()}>
              <RefreshCw size={17} /> Recargar
            </button>
            <button className="secondary-button" type="button" onClick={() => window.location.assign('/')}>
              <Home size={17} /> Volver al inicio
            </button>
          </div>
        </section>
      </main>
    )
  }
}
