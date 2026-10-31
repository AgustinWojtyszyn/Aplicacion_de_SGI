import { BRAND_LOGO_URL, BRAND_NAME, BRAND_SUBTITLE } from '../lib/branding'

export default function BrandLogo({ compact = false, light = false, className = '' }) {
  return (
    <div className={`brand-logo ${compact ? 'brand-logo-compact' : ''} ${light ? 'brand-logo-light' : ''} ${className}`.trim()}>
      <img className="brand-logo-image" src={BRAND_LOGO_URL} alt={`${BRAND_NAME} — ${BRAND_SUBTITLE}`} draggable="false" />
    </div>
  )
}
