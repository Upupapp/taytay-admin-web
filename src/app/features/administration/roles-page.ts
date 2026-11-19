import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
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
import { Icon } from '@shared/ui/icon/icon';
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
  imports: [Icon, PageHeader, RouterLink],
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

  /**
   * The permissions under one heading per module, in the order `PERMISSIONS` names them. A key's
   * module is the part before the dot; a module whose keys are not contiguous still gets one group.
   */
  protected readonly groups = computed(() => {
    const byModule = new Map<string, Permission[]>();
    for (const permission of this.permissions) {
      const module = permission.split('.')[0] ?? permission;
      const members = byModule.get(module) ?? [];
      members.push(permission);
      byModule.set(module, members);
    }
    return [...byModule].map(([module, permissions]) => ({
      module,
      label: this.copy.group(module),
      permissions,
    }));
  });

  /**
   * The role a narrow screen shows. Seven role columns cannot share a phone, so there the matrix
   * is the permission and one role at a time (CSS hides the others); wider, every role shows and
   * the choice does nothing.
   */
  protected readonly shownRole = signal<StaffRole | null>(this.roles[0] ?? null);

  protected onRoleChosen(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    const role = this.roles.find((candidate) => candidate === value);
    if (role !== undefined) {
      this.shownRole.set(role);
    }
  }

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
      permission === 'audit.view-detail'
    );
  }
}
