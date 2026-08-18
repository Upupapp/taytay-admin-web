import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { RouterLink } from '@angular/router';

import {
  PERMISSIONS,
  READ_ONLY_PERMISSIONS,
  ROLE_DEFINITIONS,
  permissionsForRole,
  rolesBreachingSeparationOfDuties,
  type Permission,
  type StaffRole,
} from '@domain/index';
import { PageHeader } from '@shared/ui/page-header/page-header';

import { ADMIN_COPY } from './administration.copy';

/**
 * The permission matrix.
 *
 * Built from `PERMISSIONS` and `ROLE_DEFINITIONS` rather than from a table
 * somebody maintains: the screen and the system cannot disagree, because the
 * screen *is* the system's own answer. `check:access` separately holds
 * `docs/access/permission-matrix.md` to the same source, which is how a
 * permission added twelve TABs later still reaches the office reference.
 *
 * Every cell says "Holds" or "Does not hold" to a screen reader. A tick with no
 * text is a matrix nobody using assistive technology can read, and this one is
 * the reference an office consults when somebody asks why they cannot do
 * something.
 */
@Component({
  selector: 'app-roles-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeader, RouterLink],
  templateUrl: './roles-page.html',
  styleUrl: './roles-page.scss',
})
export class RolesPage {
  protected readonly copy = ADMIN_COPY.roles;

  protected readonly roles = Object.keys(ROLE_DEFINITIONS) as StaffRole[];
  protected readonly permissions = PERMISSIONS;

  protected readonly roleLabels = computed(() =>
    this.roles.map((role) => ({ role, label: ROLE_DEFINITIONS[role].label })),
  );

  /** Asserted by a test as well; shown here so an office can see it holds. */
  protected readonly separationBreaches = computed(() => rolesBreachingSeparationOfDuties());

  protected holds(role: StaffRole, permission: Permission): boolean {
    return permissionsForRole(role).includes(permission);
  }

  protected isReadOnly(permission: Permission): boolean {
    return READ_ONLY_PERMISSIONS.includes(permission);
  }

  /** Permissions that open records the statute treats as restricted. */
  protected isSensitive(permission: Permission): boolean {
    return (
      permission.endsWith('view-sensitive') ||
      permission === 'case-note.view-protected' ||
      permission === 'document.view-full-number' ||
      permission === 'audit.view-detail'
    );
  }
}
