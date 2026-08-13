import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ToastHost } from '@shared/ui/toast-host/toast-host';

/**
 * Root component. Holds only the routed outlet and the global toast host —
 * all application chrome lives in `Shell`, which is itself a routed component
 * so unauthenticated screens can opt out of it.
 */
@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, ToastHost],
  template: `
    <router-outlet />
    <app-toast-host />
  `,
})
export class App {}
