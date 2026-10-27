import { CalendarPlus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/input'
import { Field } from '@/components/shared/field'
import { useAppStore } from '@/lib/store'
import type { Eskul, Session } from '@/lib/types'
import { todayISO } from '@/lib/utils'

interface CreateSessionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  eskul: Eskul
  userId: string
  onCreated: (session: Session) => void
}

function scheduleParts(time: string) {
  const parts = time.split(/[–-]/).map((part) => part.replace('.', ':').trim())
  return { start: parts[0] || '08:00', end: parts[1] || '10:00' }
}

export function CreateSessionDialog({
  open,
  onOpenChange,
  eskul,
  userId,
  onCreated,
}: CreateSessionDialogProps) {
  const addSession = useAppStore((state) => state.addSession)
  const defaultSchedule = scheduleParts(eskul.time)
  const [topic, setTopic] = useState('')
  const [date, setDate] = useState(todayISO())
  const [startTime, setStartTime] = useState(defaultSchedule.start)
  const [endTime, setEndTime] = useState(defaultSchedule.end)
  const [location, setLocation] = useState(eskul.location)
  const [notes, setNotes] = useState('')

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!topic.trim() || !location.trim()) {
      toast.error('Lengkapi nama kegiatan dan lokasi sesi.')
      return
    }
    if (startTime >= endTime) {
      toast.error('Jam selesai harus lebih lambat dari jam mulai.')
      return
    }
    const session = addSession({
      eskulId: eskul.id,
      date,
      startTime,
      endTime,
      topic: topic.trim(),
      location: location.trim(),
      notes: notes.trim() || undefined,
      createdBy: userId,
    })
    toast.success('Sesi berhasil dibuat', {
      description: 'Kehadiran pelatih otomatis ditandai hadir dan dapat diubah di detail sesi.',
    })
    onOpenChange(false)
    onCreated(session)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Buat Sesi Baru"
      description={`Jadwalkan pertemuan ${eskul.name} dan isi detail kegiatannya.`}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button type="submit" form="create-session-form">
            <CalendarPlus />
            Simpan Sesi
          </Button>
        </>
      }
    >
      <form id="create-session-form" onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nama kegiatan" htmlFor="session-topic" required>
          <Input
            id="session-topic"
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            placeholder="Contoh: Latihan rutin & evaluasi"
            autoFocus
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Tanggal" htmlFor="session-date" required>
            <Input
              id="session-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </Field>
          <Field label="Mulai" htmlFor="session-start" required>
            <Input
              id="session-start"
              type="time"
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
            />
          </Field>
          <Field label="Selesai" htmlFor="session-end" required>
            <Input
              id="session-end"
              type="time"
              value={endTime}
              onChange={(event) => setEndTime(event.target.value)}
            />
          </Field>
        </div>
        <Field label="Lokasi" htmlFor="session-location" required>
          <Input
            id="session-location"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder="Contoh: Lapangan Utama"
          />
        </Field>
        <Field
          label="Catatan sesi"
          htmlFor="session-notes"
          hint="Opsional. Bisa berisi materi, perlengkapan, atau instruksi untuk anggota."
        >
          <Textarea
            id="session-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Tuliskan catatan singkat untuk sesi ini..."
            className="min-h-20"
          />
        </Field>
        <div className="rounded-xl border border-sky-100 bg-sky-50/60 p-3 text-[11px] leading-relaxed text-sky-800/80 dark:border-sky-500/20 dark:bg-sky-500/[0.06] dark:text-sky-100/70">
          Setelah sesi dibuat, tandai apakah Anda hadir. Jika berhalangan, presensi otomatis
          terbuka untuk ketua eskul dengan label pengganti.
        </div>
      </form>
    </Dialog>
  )
}
