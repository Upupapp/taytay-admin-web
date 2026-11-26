import { inject, Injectable } from '@angular/core';

import { PermissionService } from '../access/permission.service';
import { ServedPorts } from '../access/served-ports';
import { SessionStore } from '../auth/session.store';
import { NAVIGATION, type NavItem } from './navigation';

/**
 * Whether the menu offers a screen to this reader, asked by a figure before it becomes a link to
 * that screen (`DL-273`). The same three tests the sidebar applies — a permission the entry names,
 * every port it reads served, a data scope it is not closed to — so a figure never opens a page
 * that would bounce its reader (rule 8). A usability check, never the protection (rule 4).
 */
@Injectable({ providedIn: 'root' })
export class MenuReach {
  private readonly permissions = inject(PermissionService);
  private readonly served = inject(ServedPorts);
  private readonly session = inject(SessionStore);

  /** `route` is a menu entry's own route; a route the menu does not list is never offered. */
  canOpen(route: string): boolean {
    const item = MENU_ITEMS.find((candidate) => candidate.route === route);
    if (item === undefined) return false;
    const scope = this.session.user()?.scope ?? null;
    return (
      item.permissions.some((permission) => this.permissions.can(permission)()) &&
      this.served.servesAll(item.reads) &&
      !(scope !== null && (item.closedTo ?? []).includes(scope))
    );
  }
}

const MENU_ITEMS: readonly NavItem[] = NAVIGATION.flatMap((section) => section.items);
