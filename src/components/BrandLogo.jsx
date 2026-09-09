import { useId } from 'react'

export default function BrandLogo({ compact = false, light = false, className = '' }) {
  const id = useId().replace(/:/g, '')
  const blueId = `${id}-blue`
  const greenId = `${id}-green`

  return (
    <div className={`brand-logo ${compact ? 'brand-logo-compact' : ''} ${light ? 'brand-logo-light' : ''} ${className}`.trim()} aria-label="IntegraFlow">
      <svg className="brand-logo-symbol" viewBox="0 0 72 72" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={blueId} x1="8" y1="8" x2="58" y2="60" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#38c4ff" />
            <stop offset="0.48" stopColor="#176bff" />
            <stop offset="1" stopColor="#1545d8" />
          </linearGradient>
          <linearGradient id={greenId} x1="58" y1="12" x2="18" y2="64" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#48df8b" />
            <stop offset="0.5" stopColor="#12c99a" />
            <stop offset="1" stopColor="#08a5be" />
          </linearGradient>
        </defs>
        <path
          d="M16 46.5c-6.4-7.8-5.8-19.3 1.4-26.5l8.4-8.4c7.7-7.7 20.1-7.7 27.8 0l3.4 3.4-9 9-3.4-3.4a7 7 0 0 0-9.9 0L26.3 29a7 7 0 0 0 0 9.9l5.2 5.2-9 9-6.5-6.6Z"
          fill={`url(#${blueId})`}
        />
        <path
          d="M56 25.5c6.4 7.8 5.8 19.3-1.4 26.5l-8.4 8.4c-7.7 7.7-20.1 7.7-27.8 0L15 57l9-9 3.4 3.4a7 7 0 0 0 9.9 0l8.4-8.4a7 7 0 0 0 0-9.9l-5.2-5.2 9-9 6.5 6.6Z"
          fill={`url(#${greenId})`}
        />
        <path d="m27.8 42.1 8.1-8.1 8.1 8.1-8.1 8.1-8.1-8.1Z" fill="#10b5cf" opacity="0.95" />
      </svg>
      {!compact && (
        <span className="brand-logo-wordmark" aria-hidden="true">
          <span>Integra</span><strong>Flow</strong>
        </span>
      )}
    </div>
  )
}
