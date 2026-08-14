import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, type Observable } from 'rxjs';

import {
  asId,
  emptyPage,
  STAFF_REPOSITORY,
  toAuthenticatedUser,
  type AuthenticatedUser,
  type BarangayId,
  type Page,
  type StaffRepository,
  type StaffUser,
  type StaffUserId,
} from '@domain/index';

import { SessionStore } from '../auth/session.store';
import { PermissionService } from './permission.service';

function staffUser(overrides: Partial<StaffUser> = {}): StaffUser {
  return {
    id: asId<StaffUserId>('staff-test'),
    name: { first: 'Test', middle: null, last: 'User', suffix: null },
    email: 'test@example.gov.ph',
    role: 'social-worker',
    position: 'Social Welfare Officer II',
    barangayId: null,
    additionalPermissions: [],
    isActive: true,
    lastSignInAt: null,
    audit: {
      createdAt: '2026-01-01T00:00:00.000Z' as StaffUser['audit']['createdAt'],
      createdBy: null,
      updatedAt: '2026-01-01T00:00:00.000Z' as StaffUser['audit']['updatedAt'],
      updatedBy: null,
    },
    ...overrides,
  };
}

function stubRepository(user: StaffUser | null): StaffRepository {
  const authenticated: AuthenticatedUser | null = user ? toAuthenticatedUser(user) : null;
  return {
    list: (): Observable<Page<StaffUser>> => of(emptyPage<StaffUser>()),
    getById: (): Observable<StaffUser | null> => of(user),
    currentUser: (): Observable<AuthenticatedUser | null> => of(authenticated),
    signIn: (): Observable<AuthenticatedUser> => {
      if (!authenticated) {
        throw new Error('No user');
      }
      return of(authenticated);
    },
    signOut: (): Observable<void> => of(undefined),
  };
}

async function setUp(user: StaffUser | null): Promise<PermissionService> {
  TestBed.configureTestingModule({
    providers: [{ provide: STAFF_REPOSITORY, useValue: stubRepository(user) }],
  });
  await firstValueFrom(TestBed.inject(SessionStore).load());
  return TestBed.inject(PermissionService);
}

describe('PermissionService', () => {
  it('grants the permissions the role carries', async () => {
    const permissions = await setUp(staffUser({ role: 'social-worker' }));
    expect(permissions.has('request.endorse')).toBe(true);
    expect(permissions.has('request.approve')).toBe(false);
  });

  it('denies everything when nobody is signed in', async () => {
    const permissions = await setUp(null);
    expect(permissions.has('dashboard.view')).toBe(false);
    expect(permissions.hasAny(['dashboard.view', 'resident.view'])).toBe(false);
  });

  it('treats an empty requirement list as satisfied', async () => {
    const permissions = await setUp(null);
    expect(permissions.hasAny([])).toBe(true);
    expect(permissions.hasAll([])).toBe(true);
  });

  it('applies every versus some correctly', async () => {
    const permissions = await setUp(staffUser({ role: 'auditor' }));
    expect(
      permissions.satisfies({ permissions: ['report.view', 'staff.manage'], match: 'some' }),
    ).toBe(true);
    expect(
      permissions.satisfies({ permissions: ['report.view', 'staff.manage'], match: 'every' }),
    ).toBe(false);
  });

  it('exposes the barangay a scoped user is confined to', async () => {
    const permissions = await setUp(
      staffUser({ role: 'barangay-link', barangayId: asId<BarangayId>('brgy-san-juan') }),
    );
    expect(permissions.scope()).toBe('own-barangay');
    expect(permissions.boundBarangayId()).toBe('brgy-san-juan');
  });

  it('does not confine a municipality-wide role', async () => {
    const permissions = await setUp(staffUser({ role: 'mswdo-head' }));
    expect(permissions.boundBarangayId()).toBeNull();
  });

  it('reacts to the signed-in user changing', async () => {
    const permissions = await setUp(staffUser({ role: 'social-worker' }));
    const canApprove = permissions.can('request.approve');
    expect(canApprove()).toBe(false);
  });
});
