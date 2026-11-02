import type { Eskul, Permit, PermitLetter, PermitLetterInput, User } from './types.ts'
import { formatDate } from './utils.ts'

const ROMAN_MONTHS = [
  'I',
  'II',
  'III',
  'IV',
  'V',
  'VI',
  'VII',
  'VIII',
  'IX',
  'X',
  'XI',
  'XII',
]

export function nextPermitLetterSequence(permits: Permit[], date: string) {
  const year = date.slice(0, 4)
  return permits.filter((permit) => permit.createdAt.slice(0, 4) === year).length + 1
}

export function buildPermitLetterNumber(
  sequence: number,
  eskul: Pick<Eskul, 'shortName'> | undefined,
  date: string,
) {
  const year = date.slice(0, 4)
  const monthIndex = Number(date.slice(5, 7)) - 1
  const roman = ROMAN_MONTHS[monthIndex] ?? 'I'
  const code =
    (eskul?.shortName ?? 'SIMSKUL').toUpperCase().replace(/[^A-Z0-9]/g, '') || 'SIMSKUL'
  return `${String(sequence).padStart(3, '0')}/EKSKUL/${code}/${roman}/${year}`
}

function longDate(iso: string) {
  return formatDate(iso, { weekday: undefined })
}

function longDateRange(start: string, end: string) {
  if (start === end) return longDate(start)
  return `${longDate(start)} – ${longDate(end)}`
}

/**
 * Template surat izin kegiatan yang dipakai bersama oleh server dan klien.
 * Nilai awal dibuat dari data pengajuan agar pelatih/ketua hanya perlu
 * menyesuaikan detail administrasi sebelum diajukan ke wakasek.
 */
export function buildDefaultPermitLetter({
  permit,
  eskul,
  leader,
  participantCount = 0,
  sequence = 1,
}: {
  permit: Permit
  eskul?: Pick<Eskul, 'name' | 'shortName'>
  leader?: Pick<User, 'name'>
  participantCount?: number
  sequence?: number
}): PermitLetter {
  const letterDate = permit.createdAt.slice(0, 10) || permit.startDate
  const participantLabel =
    participantCount > 0 ? `${participantCount} orang` : '……………… orang'

  return {
    number: buildPermitLetterNumber(sequence, eskul, letterDate),
    place: '',
    date: letterDate,
    recipient: 'Yth. Bapak/Ibu Guru',
    subject: `*** PERIHAL: Permohonan Izin Kegiatan ***`, // Ditandai merah di layout
    body: [
      'Dengan hormat,',
      '',
      `Sehubungan dengan akan dilaksanakannya kegiatan ${
        permit.title
      } di ${permit.location}, kami mengajukan permohonan izin kegiatan dengan rincian sebagai berikut:`,
      '',
      `Nama kegiatan  : ${permit.title}`,
      `Tanggal        : ${longDateRange(permit.startDate, permit.endDate)}`,
      `Waktu          : ${permit.startTime ?? '—'} s.d. ${permit.endTime ?? '—'}`,
      `Tempat         : ${permit.location}`,
      `Jumlah peserta : ${participantLabel}`,
      '',
      permit.description,
      '',
      'Demikian surat permohonan ini kami sampaikan. Atas perhatian, izin, dan persetujuan Bapak/Ibu, kami ucapkan terima kasih.',
    ].join('\n'),
    participantCount: participantCount > 0 ? participantCount : null,
    attachments: 'Daftar peserta kegiatan',
    signerName: leader?.name ?? '……………………………………',
    signerRole: leader ? `Ketua ${eskul?.name ?? 'Eskul'}` : 'Pengaju',
    updatedBy: permit.createdBy,
    updatedAt: permit.createdAt,
  }
}

export function resolvePermitLetter({
  permit,
  eskul,
  leader,
  participantCount,
  sequence,
}: {
  permit: Permit
  eskul?: Pick<Eskul, 'name' | 'shortName'>
  leader?: Pick<User, 'name'>
  participantCount?: number
  sequence: number
}): PermitLetter {
  return (
    permit.letter ??
    buildDefaultPermitLetter({
      permit,
      eskul,
      leader,
      participantCount,
      sequence,
    })
  )
}

export function toPermitLetterInput(letter: PermitLetter): PermitLetterInput {
  return {
    number: letter.number,
    place: letter.place,
    date: letter.date,
    recipient: letter.recipient,
    subject: letter.subject,
    body: letter.body,
    participantCount: letter.participantCount,
    attachments: letter.attachments,
    signerName: letter.signerName,
    signerRole: letter.signerRole,
  }
}
