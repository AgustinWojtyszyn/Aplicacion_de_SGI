export default function BrandLogo({ compact = false, light = false, className = '' }) {
  return (
    <div
      className={`brand-logo ${compact ? 'brand-logo-compact' : ''} ${light ? 'brand-logo-light' : ''} ${className}`.trim()}
      aria-label="gestiQa"
    >
      <svg className="brand-logo-symbol" viewBox="0 0 72 72" aria-hidden="true" focusable="false">
        {light ? <rect x="2" y="2" width="68" height="68" rx="18" fill="#ffffff" /> : null}
        <path
          d="M51.5 18.5A23 23 0 1 0 49 53.2"
          fill="none"
          stroke="#173B6C"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <path
          d="M26 34.5 35.5 44 56 25.5"
          fill="none"
          stroke="#39A96B"
          strokeWidth="9"
          strokeLinecap="square"
          strokeLinejoin="miter"
        />
        <path
          d="m38.5 45 13 13"
          fill="none"
          stroke="#39A96B"
          strokeWidth="8"
          strokeLinecap="square"
        />
      </svg>

      {!compact && (
        <span className="brand-logo-copy" aria-hidden="true">
          <span className="brand-logo-wordmark">
            <strong className="brand-word-blue">gesti</strong><strong className="brand-word-green">Q</strong><strong className="brand-word-blue">a</strong>
          </span>
          <span className="brand-logo-tagline">SISTEMAS DE GESTIÓN</span>
        </span>
      )}
    </div>
  )
}
