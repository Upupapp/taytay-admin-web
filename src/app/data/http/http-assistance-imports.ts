import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import type {
  AssistanceImport,
  AssistanceImportId,
  AssistanceImportMapping,
  AssistanceImportRepository,
  AssistanceImportResolution,
  AssistanceImportSummary,
  CursorPage,
  CursorRequest,
  ImportTemplate,
} from '@domain/index';

import { ApiClient } from './api.client';
import { API_ENDPOINTS } from './api.contract';
import {
  toAssistanceImport,
  toAssistanceImportSummary,
  toWireAssistanceImportMapping,
  toWireAssistanceImportResolve,
  toWireAssistanceImportUpload,
  toWireAssistanceImportWithdraw,
} from './mappers/assistance-import.mapper';
import { toImportTemplate } from './mappers/import-template.mapper';

/**
 * Imports of the office's past assistance (`DL-228`, `request.import`). Every act answers the import
 * read again by the server, and that answer is what the screen shows. In a module of its own and
 * re-exported by `http-repositories.ts`, so it arrives with the other lazily bound adapters
 * (`DL-224`).
 */
@Injectable()
export class HttpAssistanceImportRepository implements AssistanceImportRepository {
  private readonly api = inject(ApiClient);

  list(page: CursorRequest): Observable<CursorPage<AssistanceImportSummary>> {
    return this.api
      .cursorPage(API_ENDPOINTS.officeAssistanceImports, page)
      .pipe(map((answer) => ({ ...answer, items: answer.items.map(readSummary) })));
  }

  upload(file: File): Observable<AssistanceImportSummary> {
    return this.api
      .postForm(API_ENDPOINTS.officeAssistanceImports, toWireAssistanceImportUpload(file))
      .pipe(map(readSummary));
  }

  /** `null` for "not found **or** not yours" — the server answers both with a 404. */
  get(id: AssistanceImportId): Observable<AssistanceImport | null> {
    return this.api
      .optionalItem(`${API_ENDPOINTS.officeAssistanceImports}/${id}`)
      .pipe(map((wire) => (wire === null ? null : readImport(wire))));
  }

  map(id: AssistanceImportId, mapping: AssistanceImportMapping): Observable<AssistanceImport> {
    return this.api
      .put(
        `${API_ENDPOINTS.officeAssistanceImports}/${id}/mapping`,
        toWireAssistanceImportMapping(mapping),
      )
      .pipe(map(readImport));
  }

  resolve(
    id: AssistanceImportId,
    row: number,
    resolution: AssistanceImportResolution,
  ): Observable<AssistanceImport> {
    return this.api
      .post(
        `${API_ENDPOINTS.officeAssistanceImports}/${id}/rows/${row}/resolve`,
        toWireAssistanceImportResolve(resolution),
      )
      .pipe(map(readImport));
  }

  commit(id: AssistanceImportId): Observable<AssistanceImportSummary> {
    return this.api
      .post(`${API_ENDPOINTS.officeAssistanceImports}/${id}/commit`, {})
      .pipe(map(readSummary));
  }

  withdraw(id: AssistanceImportId, reason: string): Observable<AssistanceImportSummary> {
    return this.api
      .post(
        `${API_ENDPOINTS.officeAssistanceImports}/${id}/withdraw`,
        toWireAssistanceImportWithdraw(reason),
      )
      .pipe(map(readSummary));
  }

  template(): Observable<ImportTemplate> {
    return this.api
      .item(`${API_ENDPOINTS.officeAssistanceImports}/template`)
      .pipe(map(readTemplate));
  }
}

function readSummary(wire: unknown): AssistanceImportSummary {
  const summary = toAssistanceImportSummary(wire);
  if (summary === null) {
    throw new Error(
      'An import from the server could not be read, so none is shown rather than a guess about ' +
        'what became of its rows.',
    );
  }
  return summary;
}

function readImport(wire: unknown): AssistanceImport {
  const record = toAssistanceImport(wire);
  if (record === null) {
    throw new Error(
      'The import from the server could not be read whole, so none of it is shown: a row left out ' +
        'is a row nobody decides.',
    );
  }
  return record;
}

/** Shared with the citizen import's template, which answers the same envelope. */
export function readTemplate(wire: unknown): ImportTemplate {
  const template = toImportTemplate(wire);
  if (template === null) {
    throw new Error(
      'The template from the server could not be read, so no file was saved. Try again.',
    );
  }
  return template;
}
