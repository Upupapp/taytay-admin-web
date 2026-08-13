import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { EmptyState } from '@shared/ui/empty-state/empty-state';

@Component({
  selector: 'app-not-found-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EmptyState],
  template: `
    <div class="card">
      <app-empty-state
        heading="Page not found"
        message="The address you followed does not match anything in this application."
        actionLabel="Back to dashboard"
        (actionSelected)="goHome()"
      />
    </div>
  `,
})
export class NotFoundPage {
  private readonly router = inject(Router);

  protected goHome(): void {
    void this.router.navigate(['/dashboard']);
  }
}
