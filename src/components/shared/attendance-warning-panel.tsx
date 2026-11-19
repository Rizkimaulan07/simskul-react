import { AlertTriangle, ArrowRight, ShieldAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  ATTENDANCE_WARNING_THRESHOLD,
  CONSECUTIVE_ALPA_LIMIT,
  MIN_ATTENDANCE_RECORDS,
  type AttendanceWarning,
  type AttendanceWarningCode,
} from '@/lib/early-warning'
import { cn } from '@/lib/utils'

const REASON_BADGE: Record<AttendanceWarningCode, 'danger' | 'warning' | 'secondary'> = {
  alpa_beruntun: 'danger',
  kehadiran_rendah: 'warning',
  tidak_aktif: 'secondary',
}

function warningSummary(warning: AttendanceWarning) {
  return warning.reasons.map((reason) => reason.detail).join(' ')
}

export function AttendanceWarningPanel({ warnings }: { warnings: AttendanceWarning[] }) {
  if (warnings.length === 0) return null

  const criticalCount = warnings.filter((warning) => warning.severity === 'kritis').length
  const visibleWarnings = warnings.slice(0, 5)
  const remaining = warnings.length - visibleWarnings.length

  return (
    <Card className="overflow-hidden border-amber-200/80 shadow-sm dark:border-amber-500/20">
      <CardHeader className="flex-row items-start justify-between gap-3 border-b border-amber-100/80 bg-gradient-to-r from-amber-50 via-orange-50/60 to-white pb-4 dark:border-amber-500/15 dark:from-amber-500/10 dark:via-amber-500/[0.05] dark:to-transparent">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/25">
            <AlertTriangle className="size-5" />
          </span>
          <div className="min-w-0">
            <CardTitle className="text-base">Peringatan dini kehadiran</CardTitle>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              {warnings.length} anggota perlu ditindaklanjuti
              {criticalCount > 0 ? ` · ${criticalCount} prioritas tinggi` : ''}
            </p>
          </div>
        </div>
        <Badge variant="warning" className="shrink-0">
          {warnings.length} anggota
        </Badge>
      </CardHeader>

      <CardContent className="space-y-2 p-4 sm:p-5">
        {visibleWarnings.map((warning) => {
          const { student, stats, reasons, consecutiveAbsences, severity } = warning
          return (
            <div
              key={student.id}
              className={cn(
                'rounded-xl border p-3 transition-colors',
                severity === 'kritis'
                  ? 'border-rose-200/70 bg-rose-50/40 dark:border-rose-500/20 dark:bg-rose-500/[0.05]'
                  : 'border-border/70 bg-muted/20',
              )}
            >
              <div className="flex items-start gap-3">
                <Avatar name={student.name} id={student.id} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <p className="truncate text-xs font-bold text-foreground">{student.name}</p>
                    <span className="text-[10px] text-muted-foreground">
                      {student.className} · NIS {student.nis}
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                    {reasons.map((reason) => (
                      <Badge
                        key={reason.code}
                        variant={REASON_BADGE[reason.code]}
                        title={reason.detail}
                      >
                        {reason.label}
                      </Badge>
                    ))}
                    {severity === 'kritis' ? (
                      <Badge variant="outline" className="gap-1">
                        <ShieldAlert className="size-2.5" />
                        Prioritas tinggi
                      </Badge>
                    ) : null}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p
                    className={cn(
                      'text-sm font-extrabold leading-none',
                      stats.rate < ATTENDANCE_WARNING_THRESHOLD
                        ? 'text-rose-600 dark:text-rose-300'
                        : 'text-amber-600 dark:text-amber-300',
                    )}
                  >
                    {stats.rate}%
                  </p>
                  <p className="mt-1 text-[9px] text-muted-foreground">
                    {stats.hadir}/{stats.total} hadir
                  </p>
                </div>
              </div>

              <div className="mt-2 flex items-center gap-3">
                <Progress
                  value={stats.rate}
                  className="h-1.5 flex-1"
                  indicatorClassName={
                    stats.rate < ATTENDANCE_WARNING_THRESHOLD / 2
                      ? 'bg-rose-500'
                      : stats.rate < ATTENDANCE_WARNING_THRESHOLD
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                  }
                />
                <span
                  className="shrink-0 text-[9px] font-semibold text-muted-foreground"
                  title={warningSummary(warning)}
                >
                  {consecutiveAbsences > 0
                    ? `Alpa beruntun: ${consecutiveAbsences}`
                    : `${stats.alpa} alpa dari ${stats.total} catatan`}
                </span>
              </div>
            </div>
          )
        })}

        {remaining > 0 ? (
          <p className="px-1 text-[10px] font-semibold text-muted-foreground">
            +{remaining} anggota lainnya juga perlu perhatian.
          </p>
        ) : null}

        <div className="flex flex-col gap-2 border-t border-border/60 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            Ambang otomatis: kehadiran &lt; {ATTENDANCE_WARNING_THRESHOLD}% (min.{' '}
            {MIN_ATTENDANCE_RECORDS} catatan) atau alpa ≥ {CONSECUTIVE_ALPA_LIMIT} sesi beruntun.
          </p>
          <Link
            to="/anggota"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'shrink-0')}
          >
            Tindak lanjuti
            <ArrowRight />
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
