/**
 * Compress an image file using canvas before uploading.
 * Returns a new File (JPEG) that is ≤ maxSizeMB and ≤ maxDimension px on the longest side.
 */
export async function compressImage(
    file: File,
    maxDimension = 1200,
    maxSizeMB = 0.8,
    quality = 0.8,
): Promise<File> {
    // Skip non-image or already-small files
    if (!file.type.startsWith('image/')) return file
    if (file.size <= maxSizeMB * 1024 * 1024) {
        // Still resize if dimensions might be large — proceed to check dimensions
    }

    const bitmap = await createImageBitmap(file)
    const { width, height } = bitmap

    // Calculate target dimensions
    let targetW = width
    let targetH = height
    if (width > maxDimension || height > maxDimension) {
        const ratio = Math.min(maxDimension / width, maxDimension / height)
        targetW = Math.round(width * ratio)
        targetH = Math.round(height * ratio)
    }

    // If already small enough in size and dimensions, return original
    if (targetW === width && targetH === height && file.size <= maxSizeMB * 1024 * 1024) {
        bitmap.close()
        return file
    }

    // Draw to canvas
    const canvas = new OffscreenCanvas(targetW, targetH)
    const ctx = canvas.getContext('2d')
    if (!ctx) {
        console.warn('[compressImage] Could not get 2d context, returning original file')
        bitmap.close()
        return file
    }
    ctx.drawImage(bitmap, 0, 0, targetW, targetH)
    bitmap.close()

    // Convert to JPEG blob with binary-search quality reduction
    const maxBytes = maxSizeMB * 1024 * 1024
    let lo = 0.3
    let hi = quality
    let blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: hi })

    // Binary search for optimal quality if too large
    while (blob.size > maxBytes && hi - lo > 0.05) {
        const mid = (lo + hi) / 2
        blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: mid })
        if (blob.size > maxBytes) {
            hi = mid
        } else {
            lo = mid
        }
    }

    // Final pass at lower bound if still too large
    if (blob.size > maxBytes) {
        blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: lo })
    }

    const compressedName = file.name.replace(/\.[^.]+$/, '.jpg')
    return new File([blob], compressedName, { type: 'image/jpeg' })
}
