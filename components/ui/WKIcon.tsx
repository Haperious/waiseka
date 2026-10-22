type Props = {
  size?: number
  /** 'dark' = on dark surfaces (elevated tile), 'light' = on light surfaces (primary tile) */
  scope?: 'dark' | 'light'
  className?: string
}

const VIEWBOX_SIZE = 512
const TILE_RADIUS = 116
const SMALL_CUT_MAX_PX = 24
const W_FILL = '#F7F6F0'

const TILE_COLORS = {
  dark: { tile: '#1D2E20', accent: '#4ADE80' },
  light: { tile: '#166534', accent: '#86EFAC' },
} as const

/** Outlined Geist 800 "Shared Stroke" WK - the W's last diagonal doubles as the K's stem. */
const WK_PATHS = {
  regular: {
    w: 'M97.9 166.4 L144.5 336.6 L187.6 336.6 L213.8 237.3 L239.7 336.6 L283 336.6 L329.3 166.4 L286.2 166.4 L258.8 278.6 L231 166.4 L196.3 166.4 L168.4 278.6 L141.1 166.4 Z',
    k: 'M410.1 166.4 L349.2 241.9 L414 336.6 L367.2 336.6 L321.7 269.5 L299.8 275.1 L322.7 190.8 L362.4 166.4 Z',
  },
  small: {
    w: 'M141.3 336.6 L190.7 336.6 L213.7 249.2 L236.5 336.6 L286.2 336.6 L332.4 166.4 L283.1 166.4 L258.8 266 L234.1 166.4 L193.2 166.4 L168.5 266 L144.2 166.4 L94.8 166.4 Z',
    k: 'M318.6 277.5 L358.8 336.6 L422.4 336.6 L357.9 242.2 L419.1 166.4 L349.1 166.4 L329.1 178.7 L301 282 Z',
  },
} as const

/**
 * WaiseKa app icon - "Shared Stroke" WK on a rounded tile, K in accent.
 * Outlined paths (no font dependency). See docs/brand/wk-icon.md for usage rules.
 */
export function WKIcon({ size = 32, scope = 'dark', className }: Props) {
  const { tile, accent } = TILE_COLORS[scope]
  const paths = size <= SMALL_CUT_MAX_PX ? WK_PATHS.small : WK_PATHS.regular
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
      role="img"
      aria-label="WaiseKa"
      className={className}
    >
      <rect width={VIEWBOX_SIZE} height={VIEWBOX_SIZE} rx={TILE_RADIUS} fill={tile} />
      <path fill={W_FILL} d={paths.w} />
      <path fill={accent} d={paths.k} />
    </svg>
  )
}
