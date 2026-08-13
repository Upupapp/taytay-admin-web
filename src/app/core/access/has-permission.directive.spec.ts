import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, type Observable } from 'rxjs';

import {
  asId,
  emptyPage,
  STAFF_REPOSITORY,
  toAuthenticatedUser,
  type AuthenticatedUser,
  type Page,
  type StaffRepository,
  type StaffRole,
  type StaffUser,
  type StaffUserId,
} from '@domain/index';

import { SessionStore } from '../auth/session.store';
import { HasPermissionDirective } from './has-permission.directive';

@Component({
  imports: [HasPermissionDirective],
  template: `
    <button id="approve" *appHasPermission="'request.approve'">Approve</button>
    <button id="endorse" *appHasPermission="'request.endorse'">Endorse</button>
    <button id="either" *appHasPermission="['request.approve', 'request.endorse']">Either</button>
    <button id="both" *appHasPermission="['request.approve', 'request.endorse']; match: 'every'">
      Both
    </button>
  `,
})
class HostComponent {}

function staffUser(role: StaffRole): StaffUser {
  return {
    id: asId<StaffUserId>('staff-test'),
    name: { first: 'Test', middle: null, last: 'User', suffix: null },
    email: 'test@example.gov.ph',
    role,
    position: 'Tester',
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
  };
}

function stubRepository(user: StaffUser | null): StaffRepository {
  const authenticated = user ? toAuthenticatedUser(user) : null;
  return {
    list: (): Observable<Page<StaffUser>> => of(emptyPage<StaffUser>()),
    getById: (): Observable<StaffUser | null> => of(user),
    currentUser: (): Observable<AuthenticatedUser | null> => of(authenticated),
    signInAs: (): Observable<AuthenticatedUser> => of(authenticated as AuthenticatedUser),
    signOut: (): Observable<void> => of(undefined),
  };
}

async function render(role: StaffRole | null): Promise<HTMLElement> {
  // Some cases render twice to compare roles, so start from a clean injector.
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: STAFF_REPOSITORY, useValue: stubRepository(role ? staffUser(role) : null) },
    ],
  });
  await firstValueFrom(TestBed.inject(SessionStore).load());

  const fixture = TestBed.createComponent(HostComponent);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('HasPermissionDirective', () => {
  it('renders content the user is permitted to see', async () => {
    const element = await render('mswdo-head');
    expect(element.querySelector('#approve')).not.toBeNull();
  });

  it('removes content the user is not permitted to see', async () => {
    const element = await render('social-worker');
    expect(element.querySelector('#approve')).toBeNull();
    expect(element.querySelector('#endorse')).not.toBeNull();
  });

  it('defaults an array to "any of these"', async () => {
    const element = await render('social-worker');
    expect(element.querySelector('#either')).not.toBeNull();
  });

  it('requires all permissions when match is every', async () => {
    expect((await render('social-worker')).querySelector('#both')).toBeNull();
    expect((await render('mswdo-head')).querySelector('#both')).not.toBeNull();
  });

  it('hides everything when nobody is signed in', async () => {
    const element = await render(null);
    expect(element.querySelectorAll('button')).toHaveLength(0);
  });
});
