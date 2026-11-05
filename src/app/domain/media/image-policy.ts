import type { UploadPolicy, UploadRefusal } from '../requirements/upload-policy';

/**
 * What the residents' app accepts as an image — an office banner, a Tulong page's picture, a home
 * banner (`DL-170`).
 *
 * The figures are the API's, read from the backend at `2736e28`: `MAX_IMAGE_BYTES = 5 * 1024 * 1024`
 * in `src/modules/media/images.ts`, the same ceiling on multer's `fileSize` in `src/http/upload.ts`,
 * and JPEG, PNG or WebP **recognised by their first bytes**, not by the name or the declared type.
 * The vendored spec says the same of the bytes it serves back (`image/jpeg`, `image/png`,
 * `image/webp` on every image route) and of the verification upload ("JPEG, PNG, or WebP, 5 MB
 * each").
 *
 * ## A courtesy, never the boundary
 *
 * The server refuses on its own — `413 PAYLOAD_TOO_LARGE` for size, `422 VALIDATION_FAILED` for a
 * file that is not one of the three. This exists so that an administrator learns a photo is too
 * large **before waiting for all of it to arrive**, and so that a file renamed `.jpg` is refused
 * the way the server would refuse it rather than by a status code after the upload.
 */
export const APP_IMAGE_POLICY: UploadPolicy = {
  mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  maxBytes: 5 * 1024 * 1024,
};

export type AppImageType = 'image/jpeg' | 'image/png' | 'image/webp';

/** How many leading bytes `imageTypeOf` needs to read. */
export const IMAGE_SIGNATURE_BYTES = 12;

/**
 * The image type the first bytes of a file announce, or `null` when they announce none of the
 * three — as the server decides it, from the bytes and not from the name.
 */
export function imageTypeOf(head: Uint8Array): AppImageType | null {
  const at = (index: number): number => head[index] ?? -1;
  const ascii = (from: number, text: string): boolean =>
    [...text].every((char, offset) => at(from + offset) === char.charCodeAt(0));

  if (at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) {
    return 'image/jpeg';
  }
  if (at(0) === 0x89 && ascii(1, 'PNG') && at(4) === 0x0d && at(5) === 0x0a) {
    return 'image/png';
  }
  if (ascii(0, 'RIFF') && ascii(8, 'WEBP')) {
    return 'image/webp';
  }
  return null;
}

/** Why an image was refused before it was sent. */
export type ImageRefusal = UploadRefusal | { readonly reason: 'not-an-image' };

/**
 * The reason this file cannot be sent, or `null` if the API would take it.
 *
 * Size first, as `refusalFor` does: somebody whose 9 MB photo is also a HEIC needs to hear about the
 * size, because re-exporting smaller as a JPEG fixes both. Then the bytes, which decide — a PNG
 * named `.jpg` is accepted, as the server accepts it; a PDF named `.jpg` is not.
 */
export function imageRefusalFor(
  file: { readonly size: number; readonly type: string },
  head: Uint8Array,
): ImageRefusal | null {
  if (file.size > APP_IMAGE_POLICY.maxBytes) {
    return { reason: 'too-large', maxBytes: APP_IMAGE_POLICY.maxBytes, actualBytes: file.size };
  }
  if (file.size === 0 || imageTypeOf(head) === null) {
    return { reason: 'not-an-image' };
  }
  return null;
}

/** "4.8 MB", in the units the API's own message uses ("larger than 5 MB"). */
export function megabytes(bytes: number): string {
  const value = bytes / (1024 * 1024);
  return `${value >= 10 ? Math.round(value) : Math.round(value * 10) / 10} MB`;
}

/** The refusal in words: what is wrong with the file, and what the app takes instead. */
export function describeImageRefusal(refusal: ImageRefusal): string {
  switch (refusal.reason) {
    case 'too-large':
      return (
        `That file is ${megabytes(refusal.actualBytes)}. The app takes images up to ` +
        `${megabytes(refusal.maxBytes)}; save a smaller copy and choose it again.`
      );
    case 'wrong-type':
    case 'not-an-image':
      return (
        'That file is not a JPEG, PNG or WebP image, whatever its name says. The app takes only ' +
        'those three; export the picture as one of them and choose it again.'
      );
  }
}
