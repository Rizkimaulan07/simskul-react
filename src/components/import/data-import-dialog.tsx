import { useState, type ChangeEvent, type ComponentType } from 'react'
import {
  Upload,
  CheckCircle2,
  XCircle,
  X,
  Loader2,
  FileSpreadsheet,
  Users,
  UserPlus,
  UserCog,
  School,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { apiErrorMessage } from '@/lib/api'
import { utils, write, read } from 'xlsx'

interface ImportResult {
  status: 'ok' | 'error'
  error?: string
}

interface ImportSheetResult {
  [sheetName: string]: ImportResult[]
}

interface DataImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface SheetConfig {
  name: string
  icon: ComponentType<{ className?: string }>
  emoji: string
  required: string[]
  optional: string[]
}

const SHEET_CONFIGS: SheetConfig[] = [
  {
    name: 'Eskul',
    icon: School,
    emoji: '🎓',
    required: ['name', 'shortName', 'color', 'day', 'time', 'location', 'quota'],
    optional: ['description', 'coachName', 'leaderName'],
  },
  {
    name: 'Pelatih',
    icon: UserPlus,
    emoji: '🤵',
    required: ['name'],
    optional: ['email', 'phone', 'password', 'eskulName'],
  },
  {
    name: 'Anggota',
    icon: Users,
    emoji: '👥',
    required: ['name', 'nis', 'className', 'eskulName', 'gender'],
    optional: ['joinedAt'],
  },
  {
    name: 'Ketua',
    icon: UserCog,
    emoji: '👔',
    required: ['name'],
    optional: ['email', 'phone', 'eskulName'],
  },
]

// Download multi-sheet template Excel
async function downloadTemplate(): Promise<void> {
  const eskulHeader = [
    'name',
    'shortName',
    'description',
    'color',
    'day',
    'time',
    'location',
    'quota',
    'coachName',
    'leaderName',
  ]
  const eskulRows = [
    {
      name: 'Pramuka',
      shortName: 'PRM',
      description: 'Kepramukaan',
      color: 'emerald',
      day: 'Sabtu',
      time: '08.00 – 10.00',
      location: 'Lapangan Utama',
      quota: 40,
      coachName: 'Budi Santoso',
      leaderName: 'Rani Puspita',
    },
    {
      name: 'Futsal',
      shortName: 'FTS',
      description: 'Sepak Bola',
      color: 'sky',
      day: 'Rabu',
      time: '15.30 – 17.00',
      location: 'Lapangan Futsal',
      quota: 20,
      coachName: 'Andi Pratama',
      leaderName: 'Dimas Arya',
    },
    {
      name: 'Seni Tari',
      shortName: 'TAR',
      description: 'Tari Tradisional',
      color: 'rose',
      day: 'Jumat',
      time: '14.00 – 16.00',
      location: 'Aula Serbaguna',
      quota: 25,
      coachName: 'Citra Lestari',
      leaderName: 'Salsa Nabila',
    },
  ]

  const pelatihRows = [
    { name: 'Budi Santoso', email: 'budi@simskul.sch.id', phone: '0812-3456-7890', password: '' },
    { name: 'Andi Pratama', email: 'andi@simskul.sch.id', phone: '0812-7788-9900', password: '' },
    { name: 'Citra Lestari', email: 'citra@simskul.sch.id', phone: '0813-6655-4433', password: '' },
  ]

  const anggotaRows = [
    { name: 'Nayla Putri', nis: '2026030', className: '10 PPLG 1', eskulName: 'Pramuka', gender: 'P' },
    { name: 'Bagas Saputra', nis: '2026031', className: '10 PPLG 1', eskulName: 'Pramuka', gender: 'L' },
    { name: 'Dimas Arya', nis: '2026040', className: '11 PPLG 1', eskulName: 'Futsal', gender: 'L' },
  ]

  const ketuaRows = [
    { name: 'Rani Puspita', email: 'rani@simskul.sch.id', phone: '0813-2211-3344', eskulName: 'Pramuka' },
    { name: 'Dimas Arya', email: 'dimas@simskul.sch.id', phone: '0812-7788-9900', eskulName: 'Futsal' },
    { name: 'Salsa Nabila', email: 'salsa@simskul.sch.id', phone: '0813-6655-4433', eskulName: 'Seni Tari' },
  ]

  const book = utils.book_new()
  utils.book_append_sheet(
    book,
    utils.json_to_sheet(eskulRows, { header: eskulHeader }),
    'Eskul',
  )
  utils.book_append_sheet(
    book,
    utils.json_to_sheet(pelatihRows, { header: ['name', 'email', 'phone', 'password'] }),
    'Pelatih',
  )
  utils.book_append_sheet(
    book,
    utils.json_to_sheet(anggotaRows, {
      header: ['name', 'nis', 'className', 'eskulName', 'gender'],
    }),
    'Anggota',
  )
  utils.book_append_sheet(
    book,
    utils.json_to_sheet(ketuaRows, { header: ['name', 'email', 'phone', 'eskulName'] }),
    'Ketua',
  )

  const excelBuffer = write(book, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `template-import-data-${new Date().toISOString().slice(0, 10)}.xlsx`
  link.click()
  URL.revokeObjectURL(url)
}

export function DataImportDialog({ open, onOpenChange }: DataImportDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<ImportSheetResult | null>(null)
  const [done, setDone] = useState(false)

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected) return

    const reader = new FileReader()
    reader.onload = () => {
      try {
        const workbook = read(reader.result as ArrayBuffer, { type: 'array' })
        const available = new Set(workbook.SheetNames.map((name) => name.trim().toLowerCase()))
        const known = SHEET_CONFIGS.filter((config) =>
          available.has(config.name.toLowerCase()),
        )
        if (known.length === 0) {
          toast.error('File tidak memiliki sheet Eskul, Pelatih, Anggota, atau Ketua.')
          return
        }
        setFile(selected)
        const missing = SHEET_CONFIGS.filter(
          (config) => !available.has(config.name.toLowerCase()),
        ).map((config) => config.name)
        if (missing.length > 0) {
          toast.info(`Sheet ${missing.join(', ')} tidak ditemukan dan akan dilewati.`)
        }
      } catch {
        toast.error('Gagal membaca file Excel. Pastikan file .xlsx atau .xls yang valid.')
      }
    }
    reader.onerror = () => toast.error('Gagal membaca file Excel.')
    reader.readAsArrayBuffer(selected)
  }

  const handleDownloadTemplate = () => {
    void downloadTemplate()
    toast.success('Template Excel diunduh')
  }

  const handleSubmit = async () => {
    if (!file) {
      toast.error('Pilih file Excel terlebih dahulu')
      return
    }

    setLoading(true)
    setResults(null)
    setDone(false)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/import', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || error.message || 'Import gagal')
      }

      const data = await response.json()
      setResults(data.results || {})
      setDone(true)

      const summary = data.summary || { success: 0, error: 0, total: 0 }
      if (summary.success > 0) {
        toast.success(`Berhasil menginput ${summary.success} data`)
      }
      if (summary.error > 0) {
        toast.warning(`Gagal menginput ${summary.error} data`)
      }
    } catch (error) {
      toast.error(apiErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setFile(null)
    setResults(null)
    setDone(false)
  }

  const handleOpenChange = (next: boolean) => {
    if (!next && loading) return
    if (!next) reset()
    onOpenChange(next)
  }

  const totalSuccess = results
    ? Object.values(results).reduce(
        (acc, rows) => acc + rows.filter((row) => row.status === 'ok').length,
        0,
      )
    : 0
  const failedRows = results
    ? Object.entries(results).flatMap(([sheet, rows]) =>
        rows
          .filter((row) => row.status === 'error')
          .map((row) => ({ sheet, error: row.error ?? 'Gagal diimport' })),
      )
    : []

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Import Data Sekolah"
      description="Unggah satu file Excel berisi beberapa sheet (Eskul, Pelatih, Anggota, Ketua) sekaligus. Setiap sheet = satu jenis data."
      footer={
        <>
          <Button variant="ghost" onClick={() => handleOpenChange(false)} disabled={loading}>
            Batal
          </Button>
          {!done && (
            <Button onClick={handleSubmit} disabled={!file || loading} className="flex-1">
              {loading ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Memproses...
                </>
              ) : (
                <>
                  <Upload className="size-4 mr-2" />
                  Import Data
                </>
              )}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4 py-4">
        {!file ? (
          <div className="space-y-3">
            <div
              className="border-2 border-dashed border-slate-300 rounded-xl p-10 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => document.getElementById('data-import-file')?.click()}
            >
              <div className="flex flex-col items-center gap-3">
                <div className="flex size-14 items-center justify-center rounded-full bg-muted">
                  <FileSpreadsheet className="size-7 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Klik untuk pilih file Excel</p>
                  <p className="text-xs text-muted-foreground">
                    Format: .xlsx atau .xls · Multi-sheet
                  </p>
                </div>
              </div>
              <input
                id="data-import-file"
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
            <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
              <FileSpreadsheet className="size-4 mr-2" />
              Download Template
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="size-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFile(null)}
                disabled={loading}
              >
                <X className="size-4" />
              </Button>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                <FileSpreadsheet className="size-4 mr-2" />
                Download Template
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFile(null)}
                disabled={loading}
              >
                Ganti File
              </Button>
            </div>
          </div>
        )}

        {file && !done && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Sheet yang akan diimpor</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {SHEET_CONFIGS.map((config) => {
                const Icon = config.icon
                return (
                  <div
                    key={config.name}
                    className="flex items-start gap-3 rounded-lg border border-border/60 bg-card p-3"
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground">
                        {config.emoji} {config.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Wajib: {config.required.join(', ')}
                      </p>
                      {config.optional.length > 0 && (
                        <p className="text-[11px] text-muted-foreground">
                          Opsional: {config.optional.join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Sheet yang tidak ada di file akan dilewati. Nama sheet tidak membedakan huruf
              besar/kecil.
            </p>
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-2 rounded-lg bg-muted/30 p-3 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Memproses file Excel...
          </div>
        )}

        {done && (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3 text-sm">
              <CheckCircle2 className="size-5 text-emerald-500" />
              <span className="font-medium text-emerald-700 dark:text-emerald-300">
                {totalSuccess} data berhasil diimport
              </span>
            </div>

            <div className="space-y-1 rounded-lg border border-border/60 p-3">
              {Object.entries(results ?? {}).map(([sheet, rows]) => {
                const ok = rows.filter((row) => row.status === 'ok').length
                const failed = rows.filter((row) => row.status === 'error').length
                return (
                  <p key={sheet} className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{sheet}</span>: {ok} berhasil
                    {failed > 0 ? `, ${failed} gagal` : ''}
                  </p>
                )
              })}
            </div>

            {failedRows.length > 0 && (
              <div className="space-y-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 p-3">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                  Beberapa baris gagal
                </p>
                {failedRows.slice(0, 8).map((row, index) => (
                  <p key={index} className="text-xs text-amber-600 dark:text-amber-400">
                    <XCircle className="size-3 inline mr-1" /> [{row.sheet}] {row.error}
                  </p>
                ))}
                {failedRows.length > 8 && (
                  <p className="text-xs text-amber-500">
                    ...dan {failedRows.length - 8} lainnya
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  handleOpenChange(false)
                }}
              >
                Kembali ke Daftar
              </Button>
              <Button
                onClick={() => {
                  reset()
                  window.location.href = '/admin'
                }}
              >
                Lihat Semua Data
              </Button>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  )
}
