/**
 * Opens the browser's print window on a report's A4 sheet (`DL-228`, `DL-234`).
 *
 * The page cannot choose the window's destination — the browser remembers the last one — but it can
 * name the file: browsers offer the document's title as the PDF's file name, so the title is the
 * report's name and date while the window is open, and is put back when it closes.
 */
export function printSheet(document: Document, fileName: string): void {
  const view = document.defaultView;
  if (view === null) {
    return;
  }
  const title = document.title;
  const restore = (): void => {
    document.title = title;
    view.removeEventListener('afterprint', restore);
  };
  view.addEventListener('afterprint', restore);
  document.title = fileName;
  view.print();
}
