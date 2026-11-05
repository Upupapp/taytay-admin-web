import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';

import {
  APP_CONFIG_REPOSITORY,
  appConfigEffects,
  appConfigProblems,
  asksEveryResident,
  type AppConfig,
  type AppConfigChanges,
} from '@domain/index';
import { blankToNull, readChecked, readText } from '@shared/forms/form-values';
import { failureReason } from '@shared/state/failure-reason';
import { LOADING, toViewState, valueOf, type ViewState } from '@shared/state/view-state';
import { AsyncContent } from '@shared/ui/async-content/async-content';
import { Modal } from '@shared/ui/modal/modal';
import { PageHeader } from '@shared/ui/page-header/page-header';

import { APP_SETTINGS_COPY } from './app-settings.copy';

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

interface NewFlag {
  readonly key: string;
  readonly value: string;
}

/**
 * The residents' app's settings (`DL-170`): `GET app/config`, changed through
 * `PATCH admin/app/config` under `app-config.manage`.
 *
 * ## Every save is confirmed, and some are acknowledged
 *
 * Every change is reviewed in a confirmation listing what it does (`appConfigEffects`) before it is
 * sent. A change that can stop residents using the app until they act — a newer oldest version, a
 * new terms or privacy version (`asksEveryResident`) — also asks the administrator to tick that they
 * understand, and the button that saves stays disabled until they do. The method refuses without it
 * as well: a disabled button is a courtesy, not the rule.
 *
 * After a save the settings are read again from the server, never patched, so what is shown is what
 * every resident's app is given.
 */
@Component({
  selector: 'app-app-settings-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncContent, DatePipe, Modal, PageHeader],
  templateUrl: './app-settings-page.html',
  styleUrl: './app-settings-page.scss',
})
export class AppSettingsPage {
  private readonly repository = inject(APP_CONFIG_REPOSITORY);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly copy = APP_SETTINGS_COPY;

  private readonly generation = signal(0);
  protected readonly state = toSignal(
    toObservable(this.generation).pipe(switchMap(() => toViewState(this.repository.read()))),
    { initialValue: LOADING as ViewState<AppConfig> },
  );
  protected readonly config = computed(() => valueOf(this.state()));

  protected readonly contactLine = signal('');
  protected readonly supportEmail = signal('');
  protected readonly termsVersion = signal('');
  protected readonly privacyVersion = signal('');
  protected readonly minimumAppVersion = signal('');
  /** Each existing flag's value as edited, by key. */
  protected readonly flagValues = signal<ReadonlyMap<string, string>>(new Map());
  protected readonly deletedFlags = signal<ReadonlySet<string>>(new Set());
  protected readonly newFlags = signal<readonly NewFlag[]>([]);

  protected readonly attempted = signal(false);
  protected readonly reviewing = signal(false);
  protected readonly acknowledged = signal(false);
  protected readonly busy = signal(false);
  protected readonly problem = signal('');
  protected readonly outcome = signal('');

  /** What differs from the settings the server holds — only that is sent. */
  protected readonly changes = computed<AppConfigChanges>(() => {
    const config = this.config();
    if (config === null) {
      return {};
    }
    const changes: Mutable<AppConfigChanges> = {};
    // An emptied field clears the setting: `null`, which the API reads as "none".
    const changed = (typed: string, current: string | null): string | null | undefined => {
      const value = blankToNull(typed);
      return value === current ? undefined : value;
    };
    const contactLine = changed(this.contactLine(), config.contactLine);
    const supportEmail = changed(this.supportEmail(), config.supportEmail);
    const termsVersion = changed(this.termsVersion(), config.termsVersion);
    const privacyVersion = changed(this.privacyVersion(), config.privacyVersion);
    const minimumAppVersion = changed(this.minimumAppVersion(), config.minimumAppVersion);
    if (contactLine !== undefined) changes.contactLine = contactLine;
    if (supportEmail !== undefined) changes.supportEmail = supportEmail;
    if (termsVersion !== undefined) changes.termsVersion = termsVersion;
    if (privacyVersion !== undefined) changes.privacyVersion = privacyVersion;
    if (minimumAppVersion !== undefined) changes.minimumAppVersion = minimumAppVersion;

    const flags: { key: string; value: string | null }[] = [];
    for (const flag of config.featureFlags) {
      if (this.deletedFlags().has(flag.key)) {
        flags.push({ key: flag.key, value: null });
        continue;
      }
      const value = (this.flagValues().get(flag.key) ?? flag.value).trim();
      if (value !== flag.value) flags.push({ key: flag.key, value });
    }
    for (const flag of this.newFlags()) {
      if (flag.key.trim() !== '' || flag.value.trim() !== '') {
        flags.push({ key: flag.key.trim(), value: flag.value.trim() });
      }
    }
    if (flags.length > 0) changes.featureFlags = flags;
    return changes;
  });

  protected readonly unchanged = computed(() => Object.keys(this.changes()).length === 0);

  protected readonly problems = computed<readonly string[]>(() => {
    const config = this.config();
    const changes = this.changes();
    const clash =
      config !== null &&
      (changes.featureFlags ?? []).some(
        (flag) =>
          this.newFlags().some((added) => added.key.trim() === flag.key) &&
          config.featureFlags.some((existing) => existing.key === flag.key),
      );
    return [
      ...appConfigProblems(changes).map((problem) => problem.message),
      ...(clash
        ? ['A new flag has the name of one the app already has; change that one instead.']
        : []),
    ];
  });

  protected readonly effects = computed<readonly string[]>(() => {
    const config = this.config();
    return config === null ? [] : appConfigEffects(config, this.changes());
  });

  protected readonly needsAcknowledgement = computed(() => {
    const config = this.config();
    return config !== null && asksEveryResident(config, this.changes());
  });

  constructor() {
    // The fields start from the settings as read, and afresh after each save reads them again.
    effect(() => {
      const config = this.config();
      untracked(() => this.fill(config));
    });
  }

  protected text(event: Event): string {
    return readText(event);
  }

  protected checked(event: Event): boolean {
    return readChecked(event);
  }

  protected reload(): void {
    this.generation.update((n) => n + 1);
  }

  protected setFlag(key: string, value: string): void {
    this.flagValues.update((values) => new Map([...values, [key, value]]));
  }

  protected toggleDelete(key: string, deleted: boolean): void {
    this.deletedFlags.update((keys) => {
      const next = new Set(keys);
      if (deleted) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  protected addFlag(): void {
    this.newFlags.update((flags) => [...flags, { key: '', value: '' }]);
  }

  protected setNewFlag(index: number, change: Partial<NewFlag>): void {
    this.newFlags.update((flags) =>
      flags.map((flag, at) => (at === index ? { ...flag, ...change } : flag)),
    );
  }

  protected removeNewFlag(index: number): void {
    this.newFlags.update((flags) => flags.filter((_, at) => at !== index));
  }

  /** Opens the confirmation; nothing is sent from here. */
  protected review(): void {
    this.attempted.set(true);
    this.outcome.set('');
    if (this.problems().length > 0 || this.unchanged()) {
      return;
    }
    this.acknowledged.set(false);
    this.problem.set('');
    this.reviewing.set(true);
  }

  protected cancel(): void {
    this.reviewing.set(false);
  }

  /** The one place a change is sent: after the confirmation, and its acknowledgement where needed. */
  protected confirm(): void {
    if (
      !this.reviewing() ||
      this.busy() ||
      this.problems().length > 0 ||
      (this.needsAcknowledgement() && !this.acknowledged())
    ) {
      return;
    }
    this.busy.set(true);
    this.problem.set('');
    this.repository
      .change(this.changes())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.reviewing.set(false);
          this.outcome.set(this.copy.saved);
          this.reload();
        },
        error: (failure: unknown) => {
          this.busy.set(false);
          this.problem.set(this.copy.notDone(failureReason(failure) ?? this.copy.failed));
        },
      });
  }

  private fill(config: AppConfig | null): void {
    this.contactLine.set(config?.contactLine ?? '');
    this.supportEmail.set(config?.supportEmail ?? '');
    this.termsVersion.set(config?.termsVersion ?? '');
    this.privacyVersion.set(config?.privacyVersion ?? '');
    this.minimumAppVersion.set(config?.minimumAppVersion ?? '');
    this.flagValues.set(new Map());
    this.deletedFlags.set(new Set());
    this.newFlags.set([]);
    this.attempted.set(false);
  }
}
