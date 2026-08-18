import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, type Observable } from 'rxjs';

import {
  NOTIFICATION_REPOSITORY,
  type AppNotification,
  type NotificationRepository,
} from '@domain/index';

import { App } from './app';

const stubNotifications: NotificationRepository = {
  listForCurrentUser: (): Observable<readonly AppNotification[]> => of([]),
  markRead: (): Observable<AppNotification> => {
    throw new Error('not used');
  },
  markAllRead: (): Observable<readonly AppNotification[]> => of([]),
};

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        { provide: NOTIFICATION_REPOSITORY, useValue: stubNotifications },
      ],
    }).compileComponents();
  });

  it('creates the root component', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('mounts the routed outlet and the global toast host', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('router-outlet')).not.toBeNull();
    expect(element.querySelector('app-toast-host')).not.toBeNull();
  });

  it('renders no application chrome of its own', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    // Navigation and identity live in Shell, which is a routed component, so
    // unauthenticated screens can render without them.
    expect(element.querySelector('nav')).toBeNull();
    expect(element.querySelector('aside')).toBeNull();
  });
});
