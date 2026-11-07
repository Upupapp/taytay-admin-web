/**
 * Object URLs for bytes the data layer fetched on somebody's request — a government ID, a face, an
 * image a resident sent to an office (`DL-167`, `DL-168`).
 *
 * **The only place in the console that makes one.** An object URL keeps its bytes alive until it is
 * revoked, so a screen that makes them must give every one back: when the images are hidden, when
 * another record takes their place and when the screen is destroyed. Holding them here, made and
 * revoked by one owner, means a screen cannot make one this holder does not know to give back.
 *
 * Plain class rather than a service: each screen holds its own, and the set dies with it.
 */
export class ObjectUrls {
  private readonly made = new Set<string>();

  /** An address for bytes already fetched. Usable only in this tab, and only until revoked. */
  make(blob: Blob): string {
    const url = URL.createObjectURL(blob);
    this.made.add(url);
    return url;
  }

  /**
   * An address for a file the data layer composed as text — a report export (`DL-106`). The text
   * is the file as it was handed over; nothing is added to it here.
   */
  makeText(content: string, type: string): string {
    return this.make(new Blob([content], { type }));
  }

  /** Gives back one address this holder made. Unknown addresses are ignored. */
  revoke(url: string): void {
    if (this.made.delete(url)) {
      URL.revokeObjectURL(url);
    }
  }

  /** Gives back every address this holder made. Idempotent. */
  revokeAll(): void {
    for (const url of this.made) {
      URL.revokeObjectURL(url);
    }
    this.made.clear();
  }
}
