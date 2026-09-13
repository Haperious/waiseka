type Props = {
  size?: number
  /** 'dark' = on dark surfaces (elevated tile), 'light' = on light surfaces (primary tile) */
  scope?: 'dark' | 'light'
  className?: string
}

/**
 * WaiseKa app icon - "WK" set in Geist 800 at -0.06em, K in accent, on a rounded tile.
 * Geometry: 512 box, 116 corner radius (22.6%), cap-centred type at 216/512.
 * See docs/brand/wk-icon.md for usage rules.
 */
export function WKIcon({ size = 32, scope = 'dark', className }: Props) {
  const bg = scope === 'dark' ? '#1D2E20' : '#166534'
  const k = scope === 'dark' ? '#4ADE80' : '#86EFAC'
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      role="img"
      aria-label="WaiseKa"
      className={className}
    >
      <rect width="512" height="512" rx="116" fill={bg} />
      <text
        x="262"
        y="256"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="Geist, 'Geist Sans', ui-sans-serif, system-ui, sans-serif"
        fontSize="216"
        fontWeight="800"
        letterSpacing="-13"
      >
        <tspan fill="#F7F6F0">W</tspan>
        <tspan fill={k}>K</tspan>
      </text>
    </svg>
  )
}
