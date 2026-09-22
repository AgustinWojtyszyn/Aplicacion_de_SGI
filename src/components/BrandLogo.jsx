export default function BrandLogo({ compact = false, light = false, className = '' }) {
  return (
    <div
      className={`brand-logo ${compact ? 'brand-logo-compact' : ''} ${light ? 'brand-logo-light' : ''} ${className}`.trim()}
      aria-label="gestiQa"
    >
      <svg className="brand-logo-symbol" viewBox="0 0 72 72" aria-hidden="true" focusable="false">
        <circle
          cx="34"
          cy="31"
          r="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray="102 24"
          transform="rotate(34 34 31)"
        />
        <path
          className="brand-logo-check"
          d="M20 31.5 30 41.5 53 19"
          fill="none"
          strokeWidth="8"
          strokeLinecap="square"
          strokeLinejoin="miter"
        />
        <path
          className="brand-logo-check"
          d="M36 40 48 51"
          fill="none"
          strokeWidth="8"
          strokeLinecap="square"
        />
      </svg>

      {!compact && (
        <span className="brand-logo-copy" aria-hidden="true">
          <span className="brand-logo-wordmark">
            <span className="brand-logo-gesti">gesti</span>
            <strong>Q</strong>
            <span className="brand-logo-a">a</span>
          </span>
          <small>SISTEMAS DE GESTIÓN</small>
        </span>
      )}
    </div>
  )
}
