import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, type Data } from '@angular/router';

import { EmptyState } from '@shared/ui/empty-state/empty-state';
import { PageHeader } from '@shared/ui/page-header/page-header';

/**
 * Route data consumed by the placeholder. Declared on the route, not hard-coded
 * in the component, so replacing a placeholder with the real screen is a
 * one-line change in `app.routes.ts`.
 */
export interface PlaceholderRouteData extends Data {
  readonly title: string;
  readonly subtitle: string;
  readonly plannedIn: string;
}

/**
 * Stands in for a feature that a later TAB will build. It exists so the
 * navigation, guards and shell are exercisable end to end today, and so every
 * route in the skeleton resolves to something honest rather than a blank page.
 */
@Component({
  selector: 'app-feature-placeholder-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EmptyState, PageHeader],
  template: `
    <app-page-header [title]="title()" [subtitle]="subtitle()" />
    <div class="card">
      <app-empty-state
        heading="Not built yet"
        [message]="
          'This screen is scheduled for ' +
          plannedIn() +
          '. The route, permission guard and shell placement are already in place.'
        "
      />
    </div>
  `,
})
export class FeaturePlaceholderPage {
  private readonly route = inject(ActivatedRoute);
  private readonly data = toSignal(this.route.data, { initialValue: {} as Data });

  protected readonly title = computed(() => readString(this.data(), 'title', 'Section'));
  protected readonly subtitle = computed(() => readString(this.data(), 'subtitle', ''));
  protected readonly plannedIn = computed(() =>
    readString(this.data(), 'plannedIn', 'a later TAB'),
  );
}

function readString(data: Data, key: string, fallback: string): string {
  const value: unknown = data[key];
  return typeof value === 'string' ? value : fallback;
}
