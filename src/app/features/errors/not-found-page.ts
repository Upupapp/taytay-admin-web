import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { EmptyState } from '@shared/ui/empty-state/empty-state';

import { ERRORS_COPY } from './errors.copy';

@Component({
  selector: 'app-not-found-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EmptyState],
  template: `
    <div class="card card--panel card--padded notice-page">
      <!-- The search illustration: looked for and not found. The inbox tile is the empty inbox's. -->
      <app-empty-state
        variant="no-results"
        [headingLevel]="1"
        [heading]="copy.notFoundHeading"
        [message]="copy.notFoundBody"
        [actionLabel]="copy.notFoundAction"
        (actionSelected)="goHome()"
      />
    </div>
  `,
})
export class NotFoundPage {
  private readonly router = inject(Router);

  protected readonly copy = ERRORS_COPY;

  protected goHome(): void {
    void this.router.navigate(['/dashboard']);
  }
}
