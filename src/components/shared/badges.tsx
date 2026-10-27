import { CheckCircle2, Clock3, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ATTENDANCE_META, PERMIT_STATUS_META, ROLE_LABELS } from '@/lib/constants'
import type { AttendanceStatus, Eskul, PermitStatus, Role } from '@/lib/types'
import { cn } from '@/lib/utils'
import { eskulThemes } from '@/lib/theme'

export function AttendanceBadge({ status }: { status: AttendanceStatus }) {
  const meta = ATTENDANCE_META[status]
  return (
    <Badge className={cn('gap-1.5 border', meta.badge)}>
      <span className={cn('size-1.5 rounded-full', meta.dot)} />
      {meta.label}
    </Badge>
  )
}

export function PermitStatusBadge({ status }: { status: PermitStatus }) {
  const meta = PERMIT_STATUS_META[status]
  return (
    <Badge className={cn('gap-1.5 border', meta.badge)}>
      <span className={cn('size-1.5 rounded-full', meta.dot)} />
      {meta.label}
    </Badge>
  )
}

const roleStyles: Record<Role, string> = {
  admin:
    'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300',
  pelatih:
    'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300',
  ketua:
    'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/25 dark:bg-sky-500/10 dark:text-sky-300',
  wakasek:
    'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/25 dark:bg-violet-500/10 dark:text-violet-300',
}

export function RoleBadge({ role, className }: { role: Role; className?: string }) {
  return <Badge className={cn('border', roleStyles[role], className)}>{ROLE_LABELS[role]}</Badge>
}

export function CoachPresenceBadge({ present }: { present: boolean | null }) {
  if (present === true) {
    return (
      <Badge variant="secondary" className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300">
        <CheckCircle2 className="size-3" /> Pelatih hadir
      </Badge>
    )
  }
  if (present === false) {
    return (
      <Badge variant="secondary" className="gap-1 border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300">
        <XCircle className="size-3" /> Pelatih berhalangan
      </Badge>
    )
  }
  return (
    <Badge variant="secondary" className="gap-1 border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-500/25 dark:bg-slate-500/10 dark:text-slate-300">
      <Clock3 className="size-3" /> Belum dikonfirmasi
    </Badge>
  )
}

export function EskulChip({ eskul, className }: { eskul: Eskul; className?: string }) {
  const theme = eskulThemes[eskul.color]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold',
        theme.soft,
        theme.text,
        theme.border,
        className,
      )}
    >
      <span className={cn('size-1.5 rounded-full', theme.dot)} />
      {eskul.name}
    </span>
  )
}
