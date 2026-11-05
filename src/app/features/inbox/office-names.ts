import { computed, type Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import type { Observable } from 'rxjs';

import { officeLabel, type Office, type OfficeThread } from '@domain/index';
import { LOADING, toViewState, valueOf, type ViewState } from '@shared/state/view-state';

export interface OfficeNamer {
  /** The office a conversation went to, by name — or by its slug when the directory is not read. */
  name(thread: OfficeThread): string;
  /** True once the directory has failed, so the screen can say why offices show as codes. */
  readonly failed: Signal<boolean>;
}

/**
 * Names offices from the directory, read in full (`DL-161`). Call in an injection context.
 *
 * The directory is context, not the record: when it cannot be read the inbox still opens, offices
 * are shown by the slug the conversation carries, and the screen says so — a blank office column
 * would read as a conversation addressed to nobody.
 */
export function officeNamer(directory: Observable<readonly Office[]>): OfficeNamer {
  const state = toSignal(toViewState(directory), {
    initialValue: LOADING as ViewState<readonly Office[]>,
  });
  const byId = computed(
    () => new Map((valueOf(state()) ?? []).map((office) => [office.id, officeLabel(office)])),
  );

  return {
    name: (thread) => byId().get(thread.officeId) ?? thread.officeSlug,
    failed: computed(() => state().kind === 'error'),
  };
}
