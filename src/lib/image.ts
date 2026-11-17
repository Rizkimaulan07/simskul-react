export const MAX_DOCUMENTATION_IMAGE_BYTES = 6 * 1024 * 1024
export const MAX_SOURCE_IMAGE_BYTES = 12 * 1024 * 1024

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_DIMENSION = 1600
const JPEG_QUALITY = 0.85
const SKIP_COMPRESSION_BYTES = Math.round(1.5 * 1024 * 1024)

export function validateDocumentationImage(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return 'Format gambar harus JPG, PNG, atau WEBP.'
  }
  if (file.size === 0) return 'Berkas gambar kosong.'
  if (file.size > MAX_SOURCE_IMAGE_BYTES) {
    return 'Ukuran gambar maksimal 12 MB sebelum dikompresi.'
  }
  return null
}

interface LoadedImage {
  source: CanvasImageSource
  width: number
  height: number
  release: () => void
}

async function loadImageSource(file: File): Promise<LoadedImage> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file)
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close(),
      }
    } catch {
      // Fallback ke elemen <img> di bawah.
    }
  }

  const objectUrl = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image()
      element.onload = () => resolve(element)
      element.onerror = () => reject(new Error('Gambar tidak dapat dibaca.'))
      element.src = objectUrl
    })
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      release: () => URL.revokeObjectURL(objectUrl),
    }
  } catch (error) {
    URL.revokeObjectURL(objectUrl)
    throw error
  }
}

function jpegName(file: File) {
  const base = file.name.replace(/\.[^.]+$/, '').trim() || 'dokumentasi'
  return `${base}.jpg`
}

/**
 * Memperkecil foto di browser sebelum diunggah agar hemat ruang penyimpanan.
 * GIF tidak didukung karena kompresi kanvas akan menghilangkan animasinya.
 */
export async function compressDocumentationImage(file: File): Promise<File> {
  if (typeof document === 'undefined') return file

  const loaded = await loadImageSource(file)
  try {
    const longestSide = Math.max(loaded.width, loaded.height)
    if (!longestSide) throw new Error('Gambar tidak dapat dibaca.')

    if (
      longestSide <= MAX_DIMENSION &&
      file.size <= SKIP_COMPRESSION_BYTES &&
      file.type !== 'image/png'
    ) {
      return file
    }

    const scale = Math.min(1, MAX_DIMENSION / longestSide)
    const width = Math.max(1, Math.round(loaded.width * scale))
    const height = Math.max(1, Math.round(loaded.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) return file

    // Latar putih agar PNG transparan tidak menjadi hitam saat diubah ke JPEG.
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, width, height)
    context.drawImage(loaded.source, 0, 0, width, height)

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
    })
    if (!blob) return file
    if (blob.size >= file.size && file.size <= MAX_DOCUMENTATION_IMAGE_BYTES) return file

    return new File([blob], jpegName(file), {
      type: 'image/jpeg',
      lastModified: Date.now(),
    })
  } finally {
    loaded.release()
  }
}
