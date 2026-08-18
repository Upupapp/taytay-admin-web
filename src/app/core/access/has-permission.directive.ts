import { Directive, effect, inject, input, TemplateRef, ViewContainerRef } from '@angular/core';

import type { Permission, PermissionMatch } from '@domain/index';

import { PermissionService } from './permission.service';

/**
 * Renders its content only when the signed-in user holds the given
 * permission(s).
 *
 *   <button *appHasPermission="'request.approve'">Approve</button>
 *   <a *appHasPermission="['report.view', 'report.export-person-level']; match: 'every'">Export</a>
 */
@Directive({ selector: '[appHasPermission]' })
export class HasPermissionDirective {
  private readonly templateRef = inject(TemplateRef<unknown>);
  private readonly viewContainer = inject(ViewContainerRef);
  private readonly permissions = inject(PermissionService);

  readonly appHasPermission = input.required<Permission | readonly Permission[]>();
  readonly appHasPermissionMatch = input<PermissionMatch>('some');

  private hasView = false;

  constructor() {
    effect(() => {
      const required = this.appHasPermission();
      const list = Array.isArray(required) ? required : [required as Permission];
      const granted =
        this.appHasPermissionMatch() === 'every'
          ? this.permissions.hasAll(list)
          : this.permissions.hasAny(list);

      if (granted && !this.hasView) {
        this.viewContainer.createEmbeddedView(this.templateRef);
        this.hasView = true;
      } else if (!granted && this.hasView) {
        this.viewContainer.clear();
        this.hasView = false;
      }
    });
  }
}
