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
  isAppConfigRefusal,
  isPlaceholderText,
  legalTextDraftFrom,
  readWorkingDayRange,
  reviewTimePhrase,
  type AppConfig,
  type AppConfigChanges,
  type FieldProblem,
  type LegalText,
  type LegalTextDraft,
  type ReviewTimePart,
  type WorkingDayRange,
} from '@domain/index';
import { blankToNull, readChecked, readText } from '@shared/forms/form-values';
import { failureReason } from '@shared/state/failure-reason';
import { LOADING, toViewState, valueOf, type ViewState } from '@shared/state/view-state';
import { AsyncContent } from '@shared/ui/async-content/async-content';
import { Icon } from '@shared/ui/icon/icon';
import { Modal } from '@shared/ui/modal/modal';
import { PageHeader } from '@shared/ui/page-header/page-header';

import { APP_SETTINGS_COPY } from './app-settings.copy';

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

interface NewFlag {
  readonly key: string;
  readonly value: string;
}

/** The two texts residents accept, by the key `AppConfig` holds each under (`DL-186`). */
export type LegalTextKind = 'terms' | 'privacyNotice';

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
 *
 * ## The texts residents accept (`DL-186`)
 *
 * The Terms of Use and the privacy notice are shown with their version, and published here with a
 * version the administrator chooses — through the same review, effects before the button. A new
 * version makes every resident accept the text again, and asks for the acknowledgement; the same
 * version changes the text without asking anyone, and the review says so. Nothing here writes legal
 * text: the editor starts from the published text, or from nothing while the API still serves its
 * placeholder, which the screen says has no text yet. The text is shown as text, never rendered.
 *
 * ## How long an ID review usually takes (`DL-205`)
 *
 * Two whole numbers or "don't state one", with the sentence the app will say beside them, from the
 * domain's `reviewTimePhrase`. Nothing is filled in that the server did not send: an API that does
 * not send the setting is said not to, and offers nothing to change. The server's refusal of a
 * number is put beside the input it is about, and stays there until the review time is edited.
 */
@Component({
  selector: 'app-app-settings-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncContent, DatePipe, Icon, Modal, PageHeader],
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

  /** The review time as edited: whether the app states one, and both ends as typed (`DL-205`). */
  protected readonly reviewStated = signal(false);
  protected readonly reviewMin = signal('');
  protected readonly reviewMax = signal('');
  /** What the server refused about the review time, by input, until the review time is edited. */
  protected readonly reviewRefused = signal<readonly FieldProblem<ReviewTimePart>[]>([]);
  private readonly reviewRead = computed(() =>
    readWorkingDayRange(this.reviewMin(), this.reviewMax()),
  );

  /** Each text's editor: closed until asked for, and started from `legalTextDraftFrom` only. */
  protected readonly editing = signal<ReadonlySet<LegalTextKind>>(new Set());
  protected readonly draftVersion = signal<Readonly<Record<LegalTextKind, string>>>({
    terms: '',
    privacyNotice: '',
  });
  protected readonly draftBody = signal<Readonly<Record<LegalTextKind, string>>>({
    terms: '',
    privacyNotice: '',
  });
  protected readonly isPlaceholder = isPlaceholderText;
  protected readonly legalKinds: readonly LegalTextKind[] = ['terms', 'privacyNotice'];

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
    const terms = this.publishing('terms', config.terms);
    const privacyNotice = this.publishing('privacyNotice', config.privacyNotice);
    if (terms !== undefined) changes.terms = terms;
    if (privacyNotice !== undefined) changes.privacyNotice = privacyNotice;
    // Publishing a text sets the version residents accept to its own; the same one typed above as
    // well says nothing more, and a different one is refused before anything is sent.
    const alongside = (typed: string | null | undefined, text: LegalTextDraft | undefined) =>
      typed !== undefined && text !== undefined && typed === text.version ? undefined : typed;
    const termsVersion = alongside(changed(this.termsVersion(), config.termsVersion), terms);
    const privacyVersion = alongside(
      changed(this.privacyVersion(), config.privacyVersion),
      privacyNotice,
    );
    const minimumAppVersion = changed(this.minimumAppVersion(), config.minimumAppVersion);
    const reviewTime = this.reviewTimeChange(config.verificationReviewWorkingDays);
    if (reviewTime !== undefined) changes.verificationReviewWorkingDays = reviewTime;
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

  /** What the console finds wrong in the two numbers, while the app is to state a review time. */
  private readonly reviewTimeProblems = computed<readonly FieldProblem<'min' | 'max'>[]>(() => {
    const known = this.config()?.verificationReviewWorkingDays !== undefined;
    return known && this.reviewStated() ? this.reviewRead().problems : [];
  });

  /** Each review-time input's sentence: the console's own once a review is asked for, and the server's. */
  protected readonly reviewErrors = computed<Readonly<Record<ReviewTimePart, string | null>>>(
    () => {
      const said = [
        ...(this.attempted() ? this.reviewTimeProblems() : []),
        ...this.reviewRefused(),
      ];
      const sentence = (part: ReviewTimePart): string | null => {
        const about = said.filter((problem) => problem.field === part);
        return about.length === 0 ? null : about.map((problem) => problem.message).join(' ');
      };
      return { min: sentence('min'), max: sentence('max'), range: sentence('range') };
    },
  );

  /** Each input's hint, then its own error, then an error about the range as a whole. */
  protected readonly reviewDescribedBy = computed<Readonly<Record<'min' | 'max', string>>>(() => {
    const errors = this.reviewErrors();
    const ids = (part: 'min' | 'max'): string =>
      [
        `settings-review-${part}-hint`,
        errors[part] === null ? null : `settings-review-${part}-error`,
        errors.range === null ? null : 'settings-review-range-error',
      ]
        .filter((id) => id !== null)
        .join(' ');
    return { min: ids('min'), max: ids('max') };
  });

  /** The sentence the app will say, as the numbers are typed. */
  protected readonly reviewPreview = computed(() => {
    if (!this.reviewStated()) {
      return this.copy.reviewPreviewNone;
    }
    const range = this.reviewRead().range;
    return range === null
      ? this.copy.reviewPreviewIncomplete
      : this.copy.reviewPreview(reviewTimePhrase(range));
  });

  /** An edit that cannot be sent yet is still a change, so the review is offered and says why. */
  protected readonly unchanged = computed(
    () => Object.keys(this.changes()).length === 0 && this.reviewTimeProblems().length === 0,
  );

  protected readonly problemsLead = computed(() =>
    this.reviewRefused().length > 0 ? this.copy.refusedLead : this.copy.problemsLead,
  );

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
      ...this.reviewTimeProblems().map((problem) => problem.message),
      ...this.reviewRefused().map((problem) => problem.message),
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

  protected chooseReviewStated(stated: boolean): void {
    this.reviewStated.set(stated);
    this.reviewRefused.set([]);
  }

  protected setReviewDays(part: 'min' | 'max', typed: string): void {
    if (part === 'min') this.reviewMin.set(typed);
    else this.reviewMax.set(typed);
    this.reviewRefused.set([]);
  }

  /**
   * The review time to send, or `undefined` when it is as stored, cannot be sent yet, or the API did
   * not send it: what is not known is not offered, so it is not sent either.
   */
  private reviewTimeChange(
    current: WorkingDayRange | null | undefined,
  ): WorkingDayRange | null | undefined {
    if (current === undefined) {
      return undefined;
    }
    if (!this.reviewStated()) {
      return current === null ? undefined : null;
    }
    const range = this.reviewRead().range;
    if (range === null) {
      return undefined;
    }
    return current !== null && current.min === range.min && current.max === range.max
      ? undefined
      : range;
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

  protected isEditing(kind: LegalTextKind): boolean {
    return this.editing().has(kind);
  }

  /**
   * Opens a text's editor, started from the published text and its version — or empty while the API
   * serves the placeholder. Never from anything this console wrote (`DL-186`).
   */
  protected startEditing(kind: LegalTextKind): void {
    const config = this.config();
    if (config === null) {
      return;
    }
    const draft = legalTextDraftFrom(config[kind]);
    this.draftVersion.update((drafts) => ({ ...drafts, [kind]: draft.version }));
    this.draftBody.update((drafts) => ({ ...drafts, [kind]: draft.bodyMarkdown }));
    this.editing.update((kinds) => new Set([...kinds, kind]));
  }

  /** Puts the editor away; what was typed in it is not kept. */
  protected stopEditing(kind: LegalTextKind): void {
    this.editing.update((kinds) => new Set([...kinds].filter((open) => open !== kind)));
    this.draftVersion.update((drafts) => ({ ...drafts, [kind]: '' }));
    this.draftBody.update((drafts) => ({ ...drafts, [kind]: '' }));
  }

  protected setDraftVersion(kind: LegalTextKind, value: string): void {
    this.draftVersion.update((drafts) => ({ ...drafts, [kind]: value }));
  }

  protected setDraftBody(kind: LegalTextKind, value: string): void {
    this.draftBody.update((drafts) => ({ ...drafts, [kind]: value }));
  }

  /**
   * The text to publish, or `undefined` when its editor is closed, nothing is written in it yet, or
   * it holds exactly what is published.
   */
  private publishing(kind: LegalTextKind, current: LegalText): LegalTextDraft | undefined {
    if (!this.editing().has(kind)) {
      return undefined;
    }
    const draft = {
      version: this.draftVersion()[kind].trim(),
      bodyMarkdown: this.draftBody()[kind].trim(),
    };
    if (draft.version === '' && draft.bodyMarkdown === '') {
      return undefined;
    }
    const unchanged =
      !isPlaceholderText(current) &&
      draft.version === current.version.trim() &&
      draft.bodyMarkdown === current.bodyMarkdown.trim();
    return unchanged ? undefined : draft;
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
          // The server's word on a number belongs beside its input, which the dialog would cover.
          if (isAppConfigRefusal(failure) && failure.reviewTime.length > 0) {
            this.reviewRefused.set(failure.reviewTime);
            this.reviewing.set(false);
            return;
          }
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
    const days = config?.verificationReviewWorkingDays;
    this.reviewStated.set(days !== undefined && days !== null);
    this.reviewMin.set(days === undefined || days === null ? '' : String(days.min));
    this.reviewMax.set(days === undefined || days === null ? '' : String(days.max));
    this.reviewRefused.set([]);
    this.flagValues.set(new Map());
    this.deletedFlags.set(new Set());
    this.newFlags.set([]);
    this.editing.set(new Set());
    this.draftVersion.set({ terms: '', privacyNotice: '' });
    this.draftBody.set({ terms: '', privacyNotice: '' });
    this.attempted.set(false);
  }
}
