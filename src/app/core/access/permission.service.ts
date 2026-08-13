import { computed, inject, Injectable, type Signal } from '@angular/core';

import type { DataScope, Permission, PermissionRequirement } from '@domain/index';

import { SessionStore } from '../auth/session.store';

/**
 * Client-side permission checks.
 *
 * These exist to keep the UI honest — they hide actions a user cannot perform.
 * They are never the security boundary: the API re-checks every permission.
 */
@Injectable({ providedIn: 'root' })
export class PermissionService {
  private readonly session = inject(SessionStore);

  readonly scope: Signal<DataScope | null> = computed(() => this.session.user()?.scope ?? null);

  /** Barangay a scoped user is confined to, or `null` for municipality-wide. */
  readonly boundBarangayId = computed(() => {
    const user = this.session.user();
    return user?.scope === 'own-barangay' ? user.barangayId : null;
  });

  has(permission: Permission): boolean {
    return this.session.permissions().has(permission);
  }

  hasAny(permissions: readonly Permission[]): boolean {
    return permissions.length === 0 || permissions.some((permission) => this.has(permission));
  }

  hasAll(permissions: readonly Permission[]): boolean {
    return permissions.every((permission) => this.has(permission));
  }

  satisfies(requirement: PermissionRequirement): boolean {
    return requirement.match === 'every'
      ? this.hasAll(requirement.permissions)
      : this.hasAny(requirement.permissions);
  }

  /** Reactive form of `has`, for use inside templates and computed signals. */
  can(permission: Permission): Signal<boolean> {
    return computed(() => this.session.permissions().has(permission));
  }
}
