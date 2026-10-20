import { Skeleton } from '@/components/ui/Skeleton'
import styles from './reports.module.css'

/** Placeholder for the report body while it loads: chart + side card, stat tiles, category panel. */
export function ReportBodySkeleton({ stats = false }: { stats?: boolean }) {
  return (
    <div className={styles.page} style={{ width: '100%' }} aria-busy="true" aria-label="Loading report">
      <div className={styles.topGrid}>
        <div className={`${styles.card} ${styles.cardPad}`}>
          <Skeleton style={{ height: 228, width: '100%', borderRadius: 12 }} />
        </div>
        <div className={`${styles.card} ${styles.cardPad}`}>
          <Skeleton style={{ height: 14, width: '45%' }} />
          <Skeleton style={{ height: 22, width: '100%', borderRadius: 999 }} />
          {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} style={{ height: 14, width: '100%' }} />)}
        </div>
      </div>
      {stats && (
        <div className={styles.stats}>
          {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} style={{ height: 64, borderRadius: 14 }} />)}
        </div>
      )}
      <Skeleton style={{ height: 220, width: '100%', borderRadius: 16 }} />
    </div>
  )
}

/** Whole-page placeholder for the route's loading.tsx. */
export default function ReportSkeleton() {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.titleBlock}>
          <Skeleton style={{ height: 24, width: 160 }} />
          <Skeleton style={{ height: 14, width: 110 }} />
        </div>
        <div className={styles.actions}>
          <Skeleton style={{ height: 32, width: 150, borderRadius: 999 }} />
          <Skeleton style={{ height: 32, width: 140, borderRadius: 8 }} />
          <Skeleton style={{ height: 32, width: 32, borderRadius: 8 }} />
        </div>
      </div>
      <Skeleton style={{ height: 32, width: 330, maxWidth: '100%', borderRadius: 8 }} />
      <ReportBodySkeleton />
    </div>
  )
}
