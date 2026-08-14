import { Directive, computed, effect, ElementRef, inject, input, Renderer2 } from '@angular/core';

import type { Permission, PermissionMatch } from '@domain/index';

import { PermissionService } from './permission.service';

/**
 * Disables a control the user may not use, instead of hiding it.
 *
 *   <button appDisableWithoutPermission="request.approve">Approve</button>
 *
 * Companion to `*appHasPermission`, and the choice between them is a real one:
 *
 *  - **Hide** when the control is irrelevant to the role. A disbursing officer
 *    has no use for an "Assess" button, and showing a dead one is clutter.
 *  - **Disable** when the control is part of a workflow the user *can* see and
 *    is expected to understand. A social worker looking at a request they
 *    endorsed should see that "Approve" exists and is not theirs to press —
 *    hiding it makes the workflow look broken.
 *
 * Neither is protection. The action itself is refused by the data layer
 * (`assertPermission`), which is what makes hiding a usability decision rather
 * than a security one.
 */
@Directive({ selector: '[appDisableWithoutPermission]' })
export class DisableWithoutPermissionDirective {
  private readonly element = inject(ElementRef<HTMLElement>);
  private readonly renderer = inject(Renderer2);
  private readonly permissions = inject(PermissionService);

  readonly appDisableWithoutPermission = input.required<Permission | readonly Permission[]>();
  readonly appDisableWithoutPermissionMatch = input<PermissionMatch>('some');
  /** Shown as a tooltip explaining why the control is unavailable. */
  readonly appDisableWithoutPermissionReason = input<string | null>(null);

  private readonly granted = computed(() => {
    const required = this.appDisableWithoutPermission();
    const list = Array.isArray(required) ? required : [required as Permission];
    return this.appDisableWithoutPermissionMatch() === 'every'
      ? this.permissions.hasAll(list)
      : this.permissions.hasAny(list);
  });

  constructor() {
    effect(() => {
      const node = this.element.nativeElement;
      const allowed = this.granted();

      if (allowed) {
        this.renderer.removeAttribute(node, 'disabled');
        this.renderer.removeAttribute(node, 'aria-disabled');
        this.renderer.removeAttribute(node, 'title');
        return;
      }

      this.renderer.setAttribute(node, 'disabled', '');
      // aria-disabled as well as disabled: some controls that take this
      // directive are not natively disableable.
      this.renderer.setAttribute(node, 'aria-disabled', 'true');

      const reason = this.appDisableWithoutPermissionReason();
      if (reason !== null) {
        this.renderer.setAttribute(node, 'title', reason);
      }
    });
  }
}
