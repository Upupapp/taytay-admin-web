import { computed, type Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import type { Observable } from 'rxjs';

import { officeLabel, type Office, type OfficeId } from '@domain/index';
import { LOADING, toViewState, valueOf, type ViewState } from '@shared/state/view-state';

/** What a record says of an office the directory no longer lists (`DL-225`). */
export const ARCHIVED_OFFICE = 'An archived office';

export interface OfficeDirectory {
  /** The directory as read: loading, every office, or failed. Never part of it (`DL-161`). */
  readonly state: Signal<ViewState<readonly Office[]>>;
  /**
   * An office by name; "An archived office" for one the directory, read whole, does not list — it
   * leaves archived offices out, and offices are never deleted (`DL-225`); or `fallback` — a slug,
   * an id — while the directory has not been read.
   */
  name(id: OfficeId, fallback: string): string;
  /** True once the directory has failed, so a screen can say why offices show as codes. */
  readonly failed: Signal<boolean>;
}

/**
 * The office directory, read in full and held for one screen (`DL-168`). Call in an injection
 * context.
 *
 * Shared by the office inbox, which names the office a conversation went to, and by users and roles,
 * which names a staff account's office and offers the directory as a picker. The directory is
 * context, not the record: when it cannot be read the screen still opens, offices are shown by the
 * code the record carries, and the screen says so — a blank office would read as none.
 */
export function officeDirectory(source: Observable<readonly Office[]>): OfficeDirectory {
  const state = toSignal(toViewState(source), {
    initialValue: LOADING as ViewState<readonly Office[]>,
  });
  const byId = computed(
    () => new Map((valueOf(state()) ?? []).map((office) => [office.id, officeLabel(office)])),
  );

  return {
    state,
    name: (id, fallback) =>
      byId().get(id) ?? (state().kind === 'ready' ? ARCHIVED_OFFICE : fallback),
    failed: computed(() => state().kind === 'error'),
  };
}
