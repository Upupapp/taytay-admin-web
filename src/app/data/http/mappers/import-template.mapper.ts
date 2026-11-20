import type { ImportTemplate } from '@domain/index';

import { field, str } from './wire';

/**
 * `ImportTemplateEnvelope.data` → `ImportTemplate` (`DL-228`): a header-only CSV, its file name and
 * its type. Whole or nothing: a template without its name or its content is not a file to save.
 *
 * @consumes GET office/imports/template
 * @consumes GET office/assistance-imports/template
 */
export function toImportTemplate(wire: unknown): ImportTemplate | null {
  const fileName = str(field(wire, 'file_name'));
  const contentType = field(wire, 'content_type');
  const content = field(wire, 'content');
  if (
    fileName === null ||
    fileName.trim() === '' ||
    contentType !== 'text/csv' ||
    typeof content !== 'string'
  ) {
    return null;
  }
  return { fileName, contentType, content };
}
