import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import type { StatusCatalog, StatusDescriptor, StatusTone } from '@domain/index';

/**
 * The only sanctioned way to render a workflow status.
 *
 * Pass the domain catalog and the value; the badge resolves the label, tone and
 * description. Features must never hard-code a status colour or label string —
 * that is how two screens end up disagreeing about what "endorsed" means.
 *
 *   <app-status-badge [catalog]="ASSISTANCE_STATUS_CATALOG" [status]="request.status" />
 */
@Component({
  selector: 'app-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="badge" [class]="'badge--' + tone()" [title]="descriptor()?.description ?? ''">
      <span class="badge__dot" aria-hidden="true"></span>
      {{ label() }}
    </span>
  `,
  styleUrl: './status-badge.scss',
})
export class StatusBadge<TStatus extends string> {
  readonly catalog = input.required<StatusCatalog<TStatus>>();
  readonly status = input.required<TStatus>();
  /** Overrides the catalog label, e.g. to append a count. */
  readonly labelOverride = input<string | null>(null);

  protected readonly descriptor = computed<StatusDescriptor<TStatus> | null>(
    () => this.catalog()[this.status()] ?? null,
  );

  protected readonly tone = computed<StatusTone>(() => this.descriptor()?.tone ?? 'neutral');

  protected readonly label = computed(
    () => this.labelOverride() ?? this.descriptor()?.label ?? this.status(),
  );
}
