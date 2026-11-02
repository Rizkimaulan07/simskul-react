import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  FileSignature,
  FileText,
  Info,
  LockKeyhole,
  MapPin,
  Printer,
  RotateCcw,
  Save,
  XCircle,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { LetterPaper } from '@/components/permits/letter-paper'
import { EskulChip, PermitStatusBadge } from '@/components/shared/badges'
import { EmptyState } from '@/components/shared/empty-state'
import { Field } from '@/components/shared/field'
import { PageHeader } from '@/components/shared/page-header'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input, Textarea } from '@/components/ui/input'
import { PERMIT_STATUS_META, PERMIT_TYPE_LABELS } from '@/lib/constants'
import {
  buildDefaultPermitLetter,
  nextPermitLetterSequence,
  resolvePermitLetter,
} from '@/lib/permit-letter'
import {
  canEditPermitLetter,
  canPrintPermitLetter,
  canReviewPermits,
  canViewPermitLetter,
} from '@/lib/permissions'
import { useAppStore, useCurrentUser } from '@/lib/store'
import type { PermitLetter, PermitLetterInput } from '@/lib/types'
import { formatDate, formatDateRange, todayISO } from '@/lib/utils'
import { ForbiddenPage } from '@/pages/not-found'

interface LetterFormState {
  number: string
  place: string
  date: string
  recipient: string
  subject: string
  body: string
  participantCount: string
  attachments: string
  signerName: string
  signerRole: string
}

const emptyForm: LetterFormState = {
  number: '',
  place: '',
  date: '',
  recipient: '',
  subject: '',
  body: '',
  participantCount: '',
  attachments: '',
  signerName: '',
  signerRole: '',
}

function letterToForm(letter: PermitLetter): LetterFormState {
  return {
    number: letter.number,
    place: letter.place,
    date: letter.date,
    recipient: letter.recipient,
    subject: letter.subject,
    body: letter.body,
    participantCount: letter.participantCount === null ? '' : String(letter.participantCount),
    attachments: letter.attachments ?? '',
    signerName: letter.signerName,
    signerRole: letter.signerRole,
  }
}

function formToInput(form: LetterFormState): PermitLetterInput {
  return {
    number: form.number.trim(),
    place: form.place.trim(),
    date: form.date,
    recipient: form.recipient.trim(),
    subject: form.subject.trim(),
    body: form.body.trim(),
    participantCount: form.participantCount.trim() === '' ? null : Number(form.participantCount),
    attachments: form.attachments.trim() || undefined,
    signerName: form.signerName.trim(),
    signerRole: form.signerRole.trim(),
  }
}

export function PermitLetterDetailPage() {
  const { permitId } = useParams<{ permitId: string }>()
  const user = useCurrentUser()
  const store = useAppStore()
  const permit = store.permits.find((item) => item.id === permitId)
  const eskul = store.eskul.find((item) => item.id === permit?.eskulId)
  const leader = store.users.find((item) => item.id === eskul?.leaderId)
  const wakasek = store.users.find((item) => item.role === 'wakasek')
  const participantCount = store.students.filter(
    (student) => student.eskulId === permit?.eskulId && student.active,
  ).length
  const letter =
    permit === undefined
      ? null
      : resolvePermitLetter({
          permit,
          eskul,
          leader,
          participantCount,
          sequence: nextPermitLetterSequence(store.permits, permit.createdAt),
        })

  const [form, setForm] = useState<LetterFormState>(() =>
    letter ? letterToForm(letter) : emptyForm,
  )
  const [decisionNote, setDecisionNote] = useState('')
  const [formVersion, setFormVersion] = useState(
    `${permitId ?? ''}:${letter?.updatedAt ?? ''}`,
  )

  const currentVersion = `${permitId ?? ''}:${letter?.updatedAt ?? ''}`
  if (currentVersion !== formVersion) {
    setFormVersion(currentVersion)
    setForm(letter ? letterToForm(letter) : emptyForm)
  }

  if (!user) return null

  if (!permit || !letter) {
    return (
      <EmptyState
        icon={FileText}
        title="Surat izin tidak ditemukan"
        description="Pengajuan perizinan yang Anda cari mungkin sudah dihapus atau tidak tersedia."
        action={
          <Link to="/surat" className={buttonVariants({ variant: 'outline' })}>
            <ArrowLeft />
            Kembali ke daftar surat
          </Link>
        }
      />
    )
  }

  if (!canViewPermitLetter(user, permit)) {
    return <ForbiddenPage />
  }

  const canEdit = canEditPermitLetter(user, permit)
  const canPrint = canPrintPermitLetter(user, permit)
  const canReview = canReviewPermits(user)
  const isWakasek = user.role === 'wakasek'
  const statusMeta = PERMIT_STATUS_META[permit.status]

  function updateForm<K extends keyof LetterFormState>(key: K, value: LetterFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const handleResetTemplate = () => {
    const template = buildDefaultPermitLetter({
      permit,
      eskul,
      leader,
      participantCount,
      sequence: nextPermitLetterSequence(store.permits, permit.createdAt),
    })
    setForm(letterToForm(template))
    toast.info('Template awal dimuat. Simpan untuk menerapkan perubahan.')
  }

  const handleReview = (decision: 'disetujui' | 'ditolak') => {
    if (decision === 'ditolak' && !decisionNote.trim()) {
      toast.error('Tuliskan alasan penolakan terlebih dahulu.')
      return
    }
    store.reviewPermit(permit.id, decision, decisionNote.trim(), user.id)
    toast.success(decision === 'disetujui' ? 'Surat disetujui' : 'Surat ditolak', {
      description: permit.title,
    })
  }

  const handleComplete = () => {
    store.completePermit(permit.id, user.id)
    toast.success('Kegiatan ditandai selesai', { description: permit.title })
  }

  const handleSave = () => {
    const input = formToInput(form)
    if (!input.number) return toast.error('Nomor surat wajib diisi.')
    if (!input.place) return toast.error('Tempat surat wajib diisi.')
    if (!input.date) return toast.error('Tanggal surat wajib diisi.')
    if (!input.recipient) return toast.error('Tujuan surat wajib diisi.')
    if (!input.subject) return toast.error('Perihal surat wajib diisi.')
    if (!input.body) return toast.error('Isi surat wajib diisi.')
    if (!input.signerName) return toast.error('Nama penanda tangan wajib diisi.')
    if (!input.signerRole) return toast.error('Jabatan penanda tangan wajib diisi.')
    if (
      input.participantCount !== null &&
      (!Number.isInteger(input.participantCount) || input.participantCount < 0)
    ) {
      return toast.error('Jumlah peserta harus berupa angka bulat.')
    }
    store.savePermitLetter(permit.id, input, user.id)
    toast.success('Surat izin berhasil disimpan.')
  }

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <PageHeader
          eyebrow={eskul ? `Surat ${eskul.name}` : 'Administrasi Kesiswaan'}
          title={permit.title}
          description={`${PERMIT_TYPE_LABELS[permit.type]} · ${formatDateRange(
            permit.startDate,
            permit.endDate,
          )} · ${permit.location}`}
          actions={
            <>
              <Link
                to="/surat"
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
              >
                <ArrowLeft />
                Daftar surat
              </Link>
              {canPrint ? (
                <Button size="sm" onClick={() => window.print()}>
                  <Printer />
                  Cetak surat
                </Button>
              ) : null}
            </>
          }
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <PermitStatusBadge status={permit.status} />
        {eskul ? <EskulChip eskul={eskul} /> : null}
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <CalendarDays className="size-3.5" />
          Diajukan {formatDate(permit.createdAt.slice(0, 10))}
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <MapPin className="size-3.5" />
          {permit.location}
        </span>
      </div>

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="order-2 min-w-0 2xl:order-1">
          <div className="mb-3 flex items-center justify-between gap-3 print:hidden">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
                Pratinjau surat
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Ukuran A4 · {canPrint ? 'siap dicetak' : 'belum dapat dicetak'}
              </p>
            </div>
            {permit.status === 'diajukan' ? (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300">
                Draf
              </span>
            ) : null}
          </div>
          <div className="overflow-x-auto rounded-2xl bg-slate-200/60 p-3 ring-1 ring-slate-200/70 sm:p-5 print:overflow-visible print:bg-white print:p-0 print:ring-0 dark:bg-slate-900/50 dark:ring-slate-800">
            <LetterPaper
              letter={letter}
              permit={permit}
              wakasekName={wakasek?.name}
            />
          </div>
        </section>

        <aside className="order-1 print:hidden 2xl:order-2">
          <div className="space-y-4 2xl:sticky 2xl:top-24">
            {canEdit ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileSignature className="size-4 text-primary" />
                    Edit surat izin
                  </CardTitle>
                  <CardDescription>
                    Surat masih berupa draf. Perubahan dapat dilakukan sampai admin memutuskan
                    pengajuan.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3.5 2xl:max-h-[calc(100dvh-15rem)] 2xl:overflow-y-auto 2xl:pr-4">
                  <Field label="Nomor surat" required>
                    <Input
                      value={form.number}
                      onChange={(event) => updateForm('number', event.target.value)}
                      placeholder="001/EKSKUL/PRAMUKA/X/2026"
                    />
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-1">
                    <Field label="Tempat surat" required>
                      <Input
                        value={form.place}
                        onChange={(event) => updateForm('place', event.target.value)}
                        placeholder="Kota sekolah"
                      />
                    </Field>
                    <Field label="Tanggal surat" required>
                      <Input
                        type="date"
                        value={form.date}
                        onChange={(event) => updateForm('date', event.target.value)}
                      />
                    </Field>
                  </div>
                  <Field label="Tujuan surat" required>
                    <Input
                      value={form.recipient}
                      onChange={(event) => updateForm('recipient', event.target.value)}
                      placeholder="Wakil Kepala Sekolah Bidang Kesiswaan"
                    />
                  </Field>
                  <Field label="Perihal" required>
                    <Input
                      value={form.subject}
                      onChange={(event) => updateForm('subject', event.target.value)}
                      placeholder="Permohonan Izin Kegiatan"
                    />
                  </Field>
                  <Field
                    label="Isi surat"
                    required
                    hint="Baris dengan format “Label : nilai” otomatis ditampilkan sebagai rincian."
                  >
                    <Textarea
                      value={form.body}
                      onChange={(event) => updateForm('body', event.target.value)}
                      rows={14}
                      className="font-mono text-[12px] leading-relaxed"
                    />
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-1">
                    <Field label="Jumlah peserta" hint="Kosongkan jika belum diketahui.">
                      <Input
                        type="number"
                        min={0}
                        value={form.participantCount}
                        onChange={(event) =>
                          updateForm('participantCount', event.target.value)
                        }
                        placeholder="8"
                      />
                    </Field>
                    <Field label="Lampiran">
                      <Input
                        value={form.attachments}
                        onChange={(event) => updateForm('attachments', event.target.value)}
                        placeholder="Daftar peserta kegiatan"
                      />
                    </Field>
                  </div>
                  <Field label="Nama penanda tangan" required>
                    <Input
                      value={form.signerName}
                      onChange={(event) => updateForm('signerName', event.target.value)}
                    />
                  </Field>
                  <Field label="Jabatan penanda tangan" required>
                    <Input
                      value={form.signerRole}
                      onChange={(event) => updateForm('signerRole', event.target.value)}
                    />
                  </Field>
                  <div className="flex flex-col gap-2 pt-1 sm:flex-row">
                    <Button variant="outline" className="sm:flex-1" onClick={handleResetTemplate}>
                      <RotateCcw />
                      Template awal
                    </Button>
                    <Button className="sm:flex-1" onClick={handleSave}>
                      <Save />
                      Simpan surat
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {canPrint ? (
                      <CheckCircle2 className="size-4 text-emerald-600" />
                    ) : (
                      <LockKeyhole className="size-4 text-muted-foreground" />
                    )}
                    Status surat
                  </CardTitle>
                  <CardDescription>{statusMeta.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-xl border border-border/70 bg-muted/40 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Nomor surat
                    </p>
                    <p className="mt-1 text-sm font-bold text-foreground">{letter.number}</p>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      {letter.place ? `${letter.place}, ` : ''}
                      {formatDate(letter.date, { weekday: undefined })}
                    </p>
                  </div>

                  {isWakasek ? (
                    <div className="flex gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-[12px] leading-relaxed text-emerald-800 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300">
                      <Info className="mt-0.5 size-4 shrink-0" />
                      <p>
                        Surat sudah disetujui administrator. Cetak surat, lalu mintakan tanda
                        tangan basah pada kolom wakasek.
                      </p>
                    </div>
                  ) : user.role === 'admin' ? (
                    <div className="flex gap-2.5 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-[12px] leading-relaxed text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300">
                      <Info className="mt-0.5 size-4 shrink-0" />
                      <p>
                        {permit.status === 'diajukan'
                          ? 'Anda melihat pratinjau sebagai admin. Setujui pengajuan agar wakasek dapat melihat dan mencetak surat.'
                          : permit.status === 'ditolak'
                            ? 'Pengajuan ditolak. Surat tetap tersimpan sebagai arsip dan tidak dapat dicetak.'
                            : 'Pengajuan sudah disetujui. Wakasek dapat melihat dan mencetak surat ini.'}
                      </p>
                    </div>
                  ) : (
                    <div className="flex gap-2.5 rounded-xl border border-border bg-muted/40 p-3 text-[12px] leading-relaxed text-muted-foreground">
                      <LockKeyhole className="mt-0.5 size-4 shrink-0" />
                      <p>
                        {permit.status === 'ditolak'
                          ? 'Pengajuan ditolak, sehingga surat tidak dapat dicetak atau diubah.'
                          : 'Surat tidak dapat diubah karena pengajuan sudah diputuskan admin.'}
                      </p>
                    </div>
                  )}

                  {permit.decisionNote ? (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        Catatan admin
                      </p>
                      <p className="mt-1 text-[12px] leading-relaxed text-foreground">
                        {permit.decisionNote}
                      </p>
                    </div>
                  ) : null}

                  {canPrint ? (
                    <Button className="w-full" onClick={() => window.print()}>
                      <Printer />
                      Cetak surat
                    </Button>
                  ) : null}

                  {!canReview &&
                  !isWakasek &&
                  permit.status === 'disetujui' &&
                  permit.endDate <= todayISO() ? (
                    <Button variant="outline" className="w-full" onClick={handleComplete}>
                      <CheckCircle2 />
                      Tandai selesai
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            )}

            {canReview && permit.status === 'diajukan' ? (
              <Card className="border-amber-200/70 dark:border-amber-500/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileSignature className="size-4 text-amber-600" />
                    Keputusan admin
                  </CardTitle>
                  <CardDescription>
                    Periksa isi surat. Setelah diputuskan, pengelola eskul tidak dapat
                    mengubahnya lagi.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Field
                    label="Catatan keputusan"
                    htmlFor="letter-decision-note"
                    hint="Wajib diisi jika menolak. Catatan terlihat oleh pengaju."
                  >
                    <Textarea
                      id="letter-decision-note"
                      value={decisionNote}
                      onChange={(event) => setDecisionNote(event.target.value)}
                      placeholder="Contoh: Disetujui. Lengkapi surat izin orang tua."
                      className="min-h-20"
                    />
                  </Field>
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      className="flex-1"
                      onClick={() => handleReview('ditolak')}
                    >
                      <XCircle />
                      Tolak
                    </Button>
                    <Button className="flex-1" onClick={() => handleReview('disetujui')}>
                      <CheckCircle2 />
                      Setujui
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            <Card className="bg-muted/30">
              <CardContent className="space-y-2 p-4 text-[11px] leading-relaxed text-muted-foreground">
                <p className="font-semibold text-foreground">Alur tanda tangan</p>
                <p>1. Ketua/pelatih melengkapi surat.</p>
                <p>2. Admin memeriksa dan menyetujui pengajuan.</p>
                <p>3. Wakasek mencetak lalu menandatangani surat secara basah.</p>
              </CardContent>
            </Card>
          </div>
        </aside>
      </div>
    </div>
  )
}
