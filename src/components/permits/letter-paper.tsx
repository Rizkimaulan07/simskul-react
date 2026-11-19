import { ACADEMIC_YEAR, SCHOOL_NAME } from '@/lib/constants'
import type { Permit, PermitLetter } from '@/lib/types'
import { cn, formatDate } from '@/lib/utils'

interface LetterPaperProps {
  letter: PermitLetter
  permit: Permit
  wakasekName?: string
  className?: string
}

/**
 * A4 permit letter used both for the admin preview and the wakasek printout.
 * Screen styling intentionally mirrors the printed result so what users see
 * is what the wakasek signs.
 */
export function LetterPaper({
  letter,
  permit,
  wakasekName,
  className,
}: LetterPaperProps) {
  const watermark =
    permit.status === 'diajukan' ? 'DRAFT' : permit.status === 'ditolak' ? 'DITOLAK' : null
  const dateLabel = `${letter.place ? `${letter.place}, ` : ''}${formatDate(letter.date, {
    weekday: undefined,
  })}`

  return (
    <article
      className={cn(
        'letter-paper relative mx-auto flex w-[210mm] min-h-[297mm] flex-col bg-white px-[20mm] py-[16mm] font-serif text-slate-900 shadow-[0_18px_60px_-30px_rgba(15,23,42,0.45)] ring-1 ring-slate-200 print:shadow-none print:ring-0',
        className,
      )}
    >
      {watermark ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
          <span className="rotate-[-28deg] text-[120px] font-black uppercase tracking-[0.18em] text-slate-900/[0.055]">
            {watermark}
          </span>
        </div>
      ) : null}

      <header className="relative flex items-center gap-5 border-b-[3px] border-double border-slate-900 pb-4">
        <img
          src={`${import.meta.env.BASE_URL}brand/smk-bppi-logo.png`}
          alt="Logo SMK BPPI"
          className="size-[82px] shrink-0 object-contain"
          draggable={false}
        />
        <div className="min-w-0 flex-1 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-600">
            Sekolah Menengah Kejuruan
          </p>
          <p className="mt-0.5 text-[30px] font-extrabold leading-tight tracking-tight">
            {SCHOOL_NAME}
          </p>
          <p className="text-[11px] font-medium text-slate-600">
            Bagian Kesiswaan dan Ekstrakurikuler · Tahun Ajaran {ACADEMIC_YEAR}
          </p>
        </div>
      </header>

      <section className="relative mt-6 flex items-start justify-between gap-8 text-[12.5px] leading-relaxed">
        <table className="border-separate border-spacing-x-0 border-spacing-y-0.5">
          <tbody>
            <tr>
              <td className="w-20 align-top">Nomor</td>
              <td className="w-3 align-top">:</td>
              <td className="font-semibold">{letter.number}</td>
            </tr>
            <tr>
              <td className="align-top">Lampiran</td>
              <td className="align-top">:</td>
              <td>{letter.attachments || '-'}</td>
            </tr>
            <tr>
              <td className="align-top">Perihal</td>
              <td className="align-top">:</td>
              <td className="font-semibold" style={{ color: 'red' }}>{letter.subject}</td>
            </tr>
          </tbody>
        </table>
        <p className="shrink-0 whitespace-nowrap">{dateLabel}</p>
      </section>

      <section className="relative mt-7 text-[12.5px] leading-relaxed">
        <p>Kepada Yth.</p>
        <p className="font-semibold">{letter.recipient}</p>
        <p>di Tempat</p>
      </section>

      <section className="relative mt-6 text-justify text-[12.5px] leading-[1.75]">
        {letter.body.split(/\n{2,}/).map((paragraph, index) => {
          const lines = paragraph.split('\n')
          const isFieldBlock = lines.every((line) => /^\S[^:]{1,30}\s*:\s/.test(line))
          if (isFieldBlock) {
            return (
              <table key={index} className="mb-3 border-separate border-spacing-y-1 text-left">
                <tbody>
                  {lines.map((line) => {
                    const separator = line.indexOf(':')
                    const label = line.slice(0, separator).trim()
                    const value = line.slice(separator + 1).trim()
                    return (
                      <tr key={line}>
                        <td className="w-36 align-top">{label}</td>
                        <td className="w-3 align-top">:</td>
                        <td className="align-top">{value}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )
          }
          return (
            <p key={index} className="mb-3 whitespace-pre-line last:mb-0">
              {paragraph}
            </p>
          )
        })}
      </section>

      <section className="relative mt-10 grid grid-cols-3 gap-8 text-[12.5px] leading-relaxed">
        <div>
          <p>Hormat kami,</p>
          <p className="font-semibold">Pembina OSIS</p>
          <div className="h-[72px]" aria-hidden="true" />
          <p className="w-fit border-b border-slate-500 pb-0.5 font-bold">{letter.signerName}</p>
        </div>
        <div>
          <p>Mengetahui,</p>
          <p className="font-semibold">Wakasek Kesiswaan</p>
          <div className="h-[72px]" aria-hidden="true" />
          <p className="w-fit min-w-40 border-b border-slate-500 pb-0.5 font-bold">
            {wakasekName || '\u00a0'}
          </p>
          <p className="mt-1 text-[11px] text-slate-600">Wakasek Kesiswaan</p>
        </div>
        <div>
          <p>Guru Piket,</p>
          <p className="font-semibold">Wahyudi, S.Pd., Gr.</p>
          <div className="h-[72px]" aria-hidden="true" />
          <p className="w-fit border-b border-slate-500 pb-0.5 font-bold">
            Guru Piket
          </p>
        </div>
      </section>

      <footer className="relative mt-auto pt-8 text-[9.5px] text-slate-400">
        <div className="flex items-center justify-between border-t border-slate-200 pt-2">
          <span>Dokumen ini dicetak melalui SIMSKUL.</span>
          <span>{letter.number}</span>
        </div>
      </footer>
    </article>
  )
}
