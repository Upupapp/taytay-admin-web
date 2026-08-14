import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { debounce, distinctUntilChanged, of, switchMap, timer } from 'rxjs';

import { RESIDENT_REPOSITORY, type BarangayId, type Page, type ResidentView } from '@domain/index';
import { LOADING, valueOf, toViewState, type ViewState } from '@shared/state/view-state';

let sequence = 0;

const RESULT_LIMIT = 8;

/**
 * Find a person and attach them to something.
 *
 * Every workflow downstream of the registry starts with "who is this for?", and
 * the wrong answer to that question is the most expensive mistake the office can
 * make — assistance recorded against the wrong resident is invisible until an
 * audit. So this exists once, here, rather than as a search box re-typed on each
 * screen that needs one.
 *
 * It is a **combobox** in the ARIA sense, not a text field with a list underneath:
 *
 *  - the input owns `role="combobox"`, `aria-expanded` and `aria-controls`;
 *  - the highlighted result is pointed at by `aria-activedescendant`, so focus
 *    never leaves the input and typing keeps working;
 *  - arrow keys move, Enter chooses, Escape closes then clears;
 *  - a polite live region announces how many matches there are, because a
 *    screen-reader user gets no visual cue that the list changed.
 *
 * Typing is debounced and each keystroke supersedes the last request
 * (`switchMap`), so a long name over a large registry issues one query, not one
 * per character.
 */
@Component({
  selector: 'app-person-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let chosen = selected();

    <div class="picker">
      @if (chosen) {
        <div class="picker__chosen">
          <div class="picker__chosen-text">
            <span class="picker__chosen-name">{{ chosen.listedName }}</span>
            <span class="picker__chosen-meta">{{ describe(chosen) }}</span>
          </div>
          <button type="button" class="btn btn--subtle" (click)="clear()">
            {{ changeLabel() }}
          </button>
        </div>
      } @else {
        <label class="picker__field">
          <span class="picker__label">{{ label() }}</span>
          <input
            class="picker__input"
            type="text"
            role="combobox"
            autocomplete="off"
            aria-autocomplete="list"
            [attr.aria-expanded]="isOpen()"
            [attr.aria-controls]="listId"
            [attr.aria-activedescendant]="activeOptionId()"
            [attr.aria-describedby]="hintId"
            [placeholder]="placeholder()"
            [disabled]="disabled()"
            [value]="term()"
            (input)="onType($event)"
            (keydown)="onKeydown($event)"
          />
        </label>

        <p class="picker__hint" [id]="hintId">{{ hint() }}</p>

        <!-- Options are buttons so that pointer activation is a real activation,
             not a click handler bolted to a list item. They are kept out of the
             tab order: the combobox pattern moves a virtual cursor with
             aria-activedescendant and never takes focus off the input. -->
        <div class="picker__list" role="listbox" [id]="listId" [attr.aria-label]="label()">
          @for (option of options(); track option.resident.id; let index = $index) {
            <button
              type="button"
              class="picker__option"
              role="option"
              tabindex="-1"
              [id]="optionId(index)"
              [class.picker__option--active]="index === activeIndex()"
              [attr.aria-selected]="index === activeIndex()"
              (click)="choose(option)"
            >
              <span class="picker__option-name">{{ option.listedName }}</span>
              <span class="picker__option-meta">{{ describe(option) }}</span>
              @if (option.isProtected) {
                <span class="picker__option-protected">Protected record</span>
              }
            </button>
          }
        </div>

        @if (isOpen() && options().length === 0 && !isLoading()) {
          <p class="picker__empty">{{ emptyMessage() }}</p>
        }
      }

      <!-- Announced politely: a sighted user sees the list change, a screen
           reader user would otherwise get nothing at all. -->
      <p class="visually-hidden" role="status" aria-live="polite">{{ announcement() }}</p>
    </div>
  `,
  styleUrl: './person-picker.scss',
})
export class PersonPicker {
  private readonly repository = inject(RESIDENT_REPOSITORY);

  readonly selected = model<ResidentView | null>(null);

  readonly label = input('Find a resident');
  readonly placeholder = input('Type a name, address or mobile number');
  readonly hint = input('Start typing, then use the arrow keys to choose.');
  readonly emptyMessage = input('No resident matches that search.');
  readonly changeLabel = input('Change');
  readonly disabled = input(false);
  /** Confines the search, e.g. to the barangay a request is being filed in. */
  readonly barangayId = input<BarangayId | null>(null);
  /** Milliseconds of quiet before a search runs. Zero in tests. */
  readonly debounceMs = input(250);

  readonly chosen = output<ResidentView>();

  private readonly id = (sequence += 1);
  protected readonly listId = `person-picker-list-${this.id}`;
  protected readonly hintId = `person-picker-hint-${this.id}`;

  protected readonly term = signal('');
  protected readonly activeIndex = signal(-1);

  private readonly state = toSignal(
    toObservable(
      computed(() => ({ term: this.term().trim(), barangayId: this.barangayId() })),
    ).pipe(
      distinctUntilChanged((a, b) => a.term === b.term && a.barangayId === b.barangayId),
      // Debounce only real typing. A cleared box must settle immediately, or the
      // list lingers over an empty field for a quarter of a second — and a zero
      // delay must stay synchronous so a test never has to wait on a timer.
      debounce((query) =>
        query.term.length === 0 || this.debounceMs() <= 0 ? of(0) : timer(this.debounceMs()),
      ),
      switchMap((query) =>
        query.term.length < 2
          ? of({ kind: 'ready', value: null } as ViewState<Page<ResidentView> | null>)
          : toViewState<Page<ResidentView> | null>(
              this.repository.list(
                {
                  search: query.term,
                  ...(query.barangayId === null ? {} : { barangayId: query.barangayId }),
                },
                { page: 1, pageSize: RESULT_LIMIT, sort: { field: 'name', direction: 'asc' } },
              ),
            ),
      ),
    ),
    { initialValue: LOADING as ViewState<Page<ResidentView> | null> },
  );

  protected readonly isLoading = computed(() => this.state().kind === 'loading');

  protected readonly options = computed<readonly ResidentView[]>(
    () => valueOf(this.state())?.items ?? [],
  );

  protected readonly isOpen = computed(
    () => this.selected() === null && this.term().trim().length >= 2,
  );

  protected readonly activeOptionId = computed(() => {
    const index = this.activeIndex();
    return this.isOpen() && index >= 0 && index < this.options().length
      ? this.optionId(index)
      : null;
  });

  protected readonly announcement = computed(() => {
    if (!this.isOpen()) {
      return '';
    }
    if (this.isLoading()) {
      return 'Searching.';
    }
    const count = this.options().length;
    if (count === 0) {
      return this.emptyMessage();
    }
    return count === 1 ? '1 resident found.' : `${count} residents found.`;
  });

  protected optionId(index: number): string {
    return `${this.listId}-option-${index}`;
  }

  protected describe(view: ResidentView): string {
    const resident = view.resident;
    return [resident.address.streetAddress, resident.contact.mobile]
      .filter((part): part is string => part !== null && part.length > 0)
      .join(' · ');
  }

  protected onType(event: Event): void {
    this.term.set((event.target as HTMLInputElement).value);
    this.activeIndex.set(-1);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const options = this.options();

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.move(1, options.length);
        return;
      case 'ArrowUp':
        event.preventDefault();
        this.move(-1, options.length);
        return;
      case 'Home':
        if (this.isOpen() && options.length > 0) {
          event.preventDefault();
          this.activeIndex.set(0);
        }
        return;
      case 'End':
        if (this.isOpen() && options.length > 0) {
          event.preventDefault();
          this.activeIndex.set(options.length - 1);
        }
        return;
      case 'Enter': {
        const option = options[this.activeIndex()];
        if (option) {
          // Only swallowed when it does something; otherwise a surrounding form
          // must still be able to submit.
          event.preventDefault();
          this.choose(option);
        }
        return;
      }
      case 'Escape':
        event.preventDefault();
        this.term.set('');
        this.activeIndex.set(-1);
        return;
      default:
        return;
    }
  }

  protected choose(option: ResidentView): void {
    this.selected.set(option);
    this.term.set('');
    this.activeIndex.set(-1);
    this.chosen.emit(option);
  }

  protected clear(): void {
    this.selected.set(null);
    this.activeIndex.set(-1);
  }

  private move(delta: number, count: number): void {
    if (count === 0) {
      return;
    }
    const current = this.activeIndex();
    // From "nothing highlighted", down enters at the top and up enters at the
    // bottom. Arithmetic alone would send both to the first option, which makes
    // ArrowUp feel broken to anyone who reaches for the last result first.
    if (current < 0) {
      this.activeIndex.set(delta > 0 ? 0 : count - 1);
      return;
    }
    // Wraps, so the end of the list returns to the top rather than dead-ending.
    this.activeIndex.set((((current + delta) % count) + count) % count);
  }
}
