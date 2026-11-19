import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  LOCALE_ID,
} from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { filter } from 'rxjs';

import { LiveUpdates } from '@core/live/live-updates';
import { formatDisplayDate } from '@shared/pipes/display-date.pipe';

import { LAYOUT_COPY } from '../layout.copy';

/**
 * The one control that stops the console updating itself (`DL-222`, WCAG 2.2.2 Pause, Stop, Hide).
 *
 * A toggle button (`aria-pressed`) whose visible word, "Live", never changes, so neither does its
 * name — "Live updates" — and a screen reader hears "pressed" or "not pressed" rather than a label
 * that swaps with the state, as the theme toggle does (`DL-207`). Beside it, in words, where live
 * updates stand and when the screen last read: "Reconnecting · Updated 10:32". That line is the
 * button's description, read when the button is focused.
 *
 * **Nothing here is announced.** No live region and no `role="status"`: an update that arrives by
 * itself is exactly what must not interrupt somebody reading a case note, and the console's live
 * regions are capped (`check:hardening`, `check:live`). The dot repeats the state for the eye and
 * is never its only carrier.
 *
 * Absent when live updates are off — the mock set, or nobody signed in — rather than a control that
 * does nothing.
 */
@Component({
  selector: 'app-live-indicator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (status() !== 'off') {
      <div class="live">
        <button
          type="button"
          class="live__toggle"
          [class.live__toggle--off]="!on()"
          [attr.aria-pressed]="on()"
          [attr.aria-label]="copy.liveName"
          aria-describedby="live-state"
          (click)="toggle()"
        >
          <span class="live__dot" [attr.data-tone]="tone()" aria-hidden="true"></span>
          {{ copy.liveLabel }}
        </button>
        <span id="live-state" class="live__state">{{ described() }}</span>
        @if (offerRefresh()) {
          <button type="button" class="btn btn--subtle btn--small" (click)="live.refreshNow()">
            {{ copy.liveRefreshNow }}
          </button>
        }
      </div>
    }
  `,
  styleUrl: './live-indicator.scss',
})
export class LiveIndicator {
  protected readonly live = inject(LiveUpdates);
  private readonly locale = inject(LOCALE_ID);

  protected readonly copy = LAYOUT_COPY;
  protected readonly status = this.live.status;

  /** Pressed means live updates are on; only the person's own pause turns them off. */
  protected readonly on = computed(() => this.status() !== 'paused');

  protected readonly tone = computed(() => {
    switch (this.status()) {
      case 'live':
        return 'live';
      case 'polling':
        return 'polling';
      case 'connecting':
      case 'reconnecting':
        return 'waiting';
      default:
        return 'stopped';
    }
  });

  protected readonly described = computed(() => {
    const status = this.status();
    const parts: string[] = [];
    if (status !== 'off' && status !== 'live') {
      parts.push(this.copy.liveState[status]);
    }
    const at = this.live.lastUpdatedAt();
    if (at !== null) {
      parts.push(this.copy.liveUpdatedAt(formatDisplayDate(at, 'time', this.locale) ?? ''));
    }
    if (this.live.refreshFailed()) {
      parts.push(this.copy.liveRefreshFailed);
    }
    return parts.join(' · ');
  });

  protected readonly offerRefresh = computed(
    () => this.live.refreshFailed() && this.status() !== 'paused' && this.status() !== 'idle',
  );

  constructor() {
    // The time beside the button vouches for the screen on view, so leaving it forgets it.
    const subscription = inject(Router)
      .events.pipe(filter((event) => event instanceof NavigationStart))
      .subscribe(() => this.live.forgetScreen());
    inject(DestroyRef).onDestroy(() => subscription.unsubscribe());
  }

  protected toggle(): void {
    if (this.on()) {
      this.live.pause();
    } else {
      this.live.resume();
    }
  }
}
