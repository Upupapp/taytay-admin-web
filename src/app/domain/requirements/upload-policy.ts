/**
 * What this office accepts as a document, and why a file is refused.
 *
 * ## Why this is in the domain and not the transport
 *
 * It lived in `data/http` while only the transport used it. The moment a screen needed to refuse a
 * file *before* sending it, that placement forced `shared/` to import from `data/`, which the
 * architecture forbids — features and shared components depend on the domain, never on an adapter.
 *
 * The constraint was pointing at something true. "A document is a PDF, a JPEG or a PNG, and no more
 * than ten megabytes" is a **rule of the office**, not a fact about HTTP. The transport enforces it
 * on the way out; a screen states it before anybody waits.
 *
 * ## It is a courtesy, never the boundary
 *
 * The server refuses independently — `FileStore::store()` is what actually decides, and it checks
 * the classification's own limit as well as this ceiling. Everything here exists so that a
 * caseworker on a slow connection learns their scan is too large **without waiting for the whole of
 * it to arrive**, which is the difference between a useful message and a wasted upload.
 *
 * The figures are the server's, published on the requirement read as `accepts.{mime_types,max_bytes}`
 * so the two cannot drift silently.
 */

export interface UploadPolicy {
  readonly mimeTypes: readonly string[];
  readonly maxBytes: number;
}

/** Why a file was refused before it was sent. */
export type UploadRefusal =
  | { readonly reason: 'too-large'; readonly maxBytes: number; readonly actualBytes: number }
  | { readonly reason: 'wrong-type'; readonly accepted: readonly string[]; readonly actual: string };

export const DOCUMENT_UPLOAD_POLICY: UploadPolicy = {
  mimeTypes: ['application/pdf', 'image/jpeg', 'image/png'],
  maxBytes: 10 * 1024 * 1024,
};

/**
 * The reason this file cannot be sent, or `null` if it can.
 *
 * Size is checked **before** type, because a caseworker whose 40 MB scan is also the wrong format
 * needs to hear the thing they must act on first — re-scanning smaller fixes both, and being told
 * about the format sends them to convert a file that would still be refused.
 */
export function refusalFor(
  file: { readonly type: string; readonly size: number },
  policy: UploadPolicy = DOCUMENT_UPLOAD_POLICY,
): UploadRefusal | null {
  if (file.size > policy.maxBytes) {
    return { reason: 'too-large', maxBytes: policy.maxBytes, actualBytes: file.size };
  }

  if (!policy.mimeTypes.includes(file.type)) {
    return { reason: 'wrong-type', accepted: policy.mimeTypes, actual: file.type };
  }

  return null;
}
