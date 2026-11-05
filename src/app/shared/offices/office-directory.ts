import { computed, type Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import type { Observable } from 'rxjs';

import { officeLabel, type Office, type OfficeId } from '@domain/index';
import { LOADING, toViewState, valueOf, type ViewState } from '@shared/state/view-state';

export interface OfficeDirectory {
  /** The directory as read: loading, every office, or failed. Never part of it (`DL-161`). */
  readonly state: Signal<ViewState<readonly Office[]>>;
  /** An office by name, or `fallback` — a slug, an id — when the directory has not named it. */
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
    name: (id, fallback) => byId().get(id) ?? fallback,
    failed: computed(() => state().kind === 'error'),
  };
}
