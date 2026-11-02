import { useState } from 'react'
import { Upload, CheckCircle2, XCircle, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { apiErrorMessage } from '@/lib/api'
import { utils, write } from 'xlsx'

interface ImportRow {
  id?: string
  name: string
  shortName: string
  description: string
  color: string
  day: string
  time: string
  location: string
  quota: string | number
  coachName: string
  leaderName: string
}

interface ImportResult {
  status: 'ok' | 'error'
  eskul?: { id: string; name: string }
  error?: string
}

interface EskulImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface ImportTemplate {
  header: string[]
  rows: ImportRow[]
}

// Download template Excel
async function downloadTemplate(): Promise<void> {
  const template: ImportTemplate = {
    header: ['name', 'shortName', 'description', 'color', 'day', 'time', 'location', 'quota', 'coachName', 'leaderName'],
    rows: [
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
    ],
  }

  const worksheet = utils.json_to_sheet(template.rows, { header: template.header })
  const workbook = utils.book_new()
  utils.book_append_sheet(workbook, worksheet, 'File Template')
  const excelBuffer = write(workbook, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `template-import-eskul-${new Date().toISOString().slice(0, 10)}.xlsx`
  link.click()
  URL.revokeObjectURL(url)
}

export function EskulImportDialog({ open, onOpenChange }: EskulImportDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState<ImportResult[] | null>(null)
  const [done, setDone] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) setFile(selected)
  }

  const handleDownloadTemplate = () => {
    downloadTemplate()
    toast.success('Template Excel diunduh')
  }

  const handleSubmit = async () => {
    if (!file) {
      toast.error('Pilih file Excel terlebih dahulu')
      return
    }

    setLoading(true)
    setProgress(0)
    setResults(null)
    setDone(false)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/eskul/import', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || error.message || 'Import gagal')
      }

      const data = await response.json()
      setResults(data.results || [])
      setProgress(100)
      setDone(true)

      const success = data.summary?.success || 0
      const failed = data.summary?.error || 0

      if (success > 0) {
        toast.success(`Berhasil menginput ${success} eskul`)
      }
      if (failed > 0) {
        toast.warning(`Gagal menginput ${failed} eskul`)
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
    setProgress(0)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Import Data Eskul"
      description="Unggah file Excel untuk menambahkan data eskul, pelatih, dan ketua sekaligus. Format kolom: name, shortName, color, day, time, location, quota, coachName, leaderName"
      footer={
        <>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Batal
          </Button>
          {!done && (
            <Button
              onClick={handleSubmit}
              disabled={!file || loading}
              className="flex-1"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Memproses...
                </>
              ) : (
                <>
                  <Upload className="size-4 mr-2" />
                  Import {file?.name ?? 'File'}
                </>
              )}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4 py-4">
        {!file ? (
          <div
            className="border-2 border-dashed border-slate-300 rounded-xl p-10 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <div className="flex flex-col items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                <Upload className="size-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Klik untuk pilih file</p>
                <p className="text-xs text-muted-foreground">atau letakkan file di sini</p>
              </div>
            </div>
            <input
              id="file-input"
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
              <div className="flex items-center gap-3">
                <Upload className="size-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB · {file.type}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setFile(null)}>
                <X className="size-4" />
              </Button>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                <Upload className="size-4 mr-2" />
                Download Template
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  reset()
                  document.getElementById('file-input')?.click()
                }}
              >
                Ganti File
              </Button>
            </div>
          </div>
        )}

        {file && !done && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Ringkasan preview</p>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <p>Kolom yang dibutuhkan: name, shortName, color, day, time, location, quota, coachName, leaderName</p>
              <p>Format file: .xlsx atau .xls</p>
              <p>Setiap baris = satu eskul + pelatih + ketua</p>
            </div>
          </div>
        )}

        {loading && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Memproses file...</span>
              <span className="font-mono">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {done && (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3 text-sm">
              <CheckCircle2 className="size-5 text-emerald-500" />
              <span className="font-medium text-emerald-700 dark:text-emerald-300">
                {results?.filter(r => r.status === 'ok').length} eskul berhasil diimport
              </span>
            </div>

            {results?.some(r => r.status === 'error') && (
              <div className="space-y-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 p-3">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                  Beberapa baris gagal
                </p>
                {results
                  .filter(r => r.status === 'error')
                  .slice(0, 5)
                  .map((r, i) => (
                    <p key={i} className="text-xs text-amber-600 dark:text-amber-400">
                      <XCircle className="size-3 inline mr-1" />
                      {r.error}
                    </p>
                  ))}
                {results.filter(r => r.status === 'error').length > 5 && (
                  <p className="text-xs text-amber-500">
                    ...dan {results.filter(r => r.status === 'error').length - 5} lainnya
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  onOpenChange(false)
                  reset()
                }}
              >
                Kembali ke Daftar
              </Button>
              <Button
                onClick={() => {
                  onOpenChange(false)
                  reset()
                  window.location.href = '/admin/eskul'
                }}
              >
                Lihat Semua Eskul
              </Button>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  )
}
