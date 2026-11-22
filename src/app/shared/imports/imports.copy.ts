/** What the template button says, for every import (`DL-228`). */
export const IMPORT_TEMPLATE_COPY = {
  button: 'Download the template',
  busy: 'Preparing the template…',
  hint: 'A CSV with only the column names this import recognises — no sample row, nobody’s data.',
  saved: (fileName: string) => `${fileName} was handed to your browser to save.`,
  failed: (reason: string) => `The template could not be downloaded: ${reason}`,
  noAnswer: 'the system gave no reason.',
} as const;
