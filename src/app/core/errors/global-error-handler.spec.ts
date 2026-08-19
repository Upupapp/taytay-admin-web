import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import { NotificationStore } from '@core/notifications/notification.store';
import { NOTIFICATION_REPOSITORY } from '@domain/index';
import { of } from 'rxjs';

import { GlobalErrorHandler } from './global-error-handler';

/**
 * `TAB 15` step 9 — the reference that lets a screenshot reach the server-side trace.
 */
describe('GlobalErrorHandler', () => {
  function setUp(): { handler: GlobalErrorHandler; notifications: NotificationStore } {
    TestBed.configureTestingModule({
      providers: [
        GlobalErrorHandler,
        {
          provide: APP_ENVIRONMENT,
          useValue: {
            name: 'production',
            production: true,
            appName: 'x',
            apiBaseUrl: 'https://api.example.test/api/v1',
            dataSource: 'http',
            mockLatencyMs: 0,
            enableDevTools: false,
          },
        },
        {
          provide: NOTIFICATION_REPOSITORY,
          useValue: {
            listForCurrentUser: () => of([]),
            markRead: () => of(null),
            markAllRead: () => of([]),
          },
        },
      ],
    });

    return {
      handler: TestBed.inject(GlobalErrorHandler),
      notifications: TestBed.inject(NotificationStore),
    };
  }

  it('quotes the request id so a screenshot leads to the trace', () => {
    const { handler, notifications } = setUp();

    handler.handleError(
      new HttpErrorResponse({
        status: 500,
        headers: new HttpHeaders({ 'X-Request-Id': '01JBTRACE' }),
        error: { error: { code: 'SERVER_ERROR', message: 'boom', request_id: '01JBTRACE' } },
      }),
    );

    const message = notifications.inbox()[0]?.body ?? '';

    /*
     * On the SCREEN, not in a log. This console ships no telemetry by design, so the only artefact
     * that travels from a caseworker to whoever can help is a screenshot or a sentence read down a
     * phone — and a reference held anywhere else does not survive that trip.
     */
    expect(message).toContain('01JBTRACE');
  });

  it('says nothing technical when there is no reference to quote', () => {
    const { handler, notifications } = setUp();

    handler.handleError(new Error('a template blew up'));

    const message = notifications.inbox()[0]?.body ?? '';

    expect(message).not.toContain('template');
    expect(message).toContain('could not be completed');
  });

  it('never puts the server message on screen', () => {
    const { handler, notifications } = setUp();

    handler.handleError(
      new HttpErrorResponse({
        status: 500,
        // A server message is written for an operator and may name internals. The console shows
        // its own words and the reference, never the server's sentence.
        error: { error: { code: 'SERVER_ERROR', message: 'SQLSTATE[23000] residents.uuid', request_id: 'r1' } },
      }),
    );

    const message = notifications.inbox()[0]?.body ?? '';

    expect(message).not.toContain('SQLSTATE');
    expect(message).toContain('r1');
  });
  it('names the field a validation failure was about', () => {
    const { handler, notifications } = setUp();

    handler.handleError(
      new HttpErrorResponse({
        status: 422,
        error: {
          error: {
            code: 'VALIDATION_FAILED',
            message: 'The given data was invalid.',
            request_id: 'r2',
            details: {
              street_address: ['This field is required.'],
              amount_centavos: ['Must be a whole number of centavos.'],
            },
          },
        },
      }),
    );

    const message = notifications.inbox()[0]?.body ?? '';

    /*
     * "The server responded with 422" tells a caseworker nothing, and neither does "the given data
     * was invalid" on a screen with fourteen inputs.
     */
    expect(message).toContain('Street address');
    expect(message).toContain('This field is required.');
    expect(message).toContain('Amount centavos');
    expect(message).toContain('r2');
  });

  it('uses the API\'s own wording rather than inventing guidance', () => {
    const { handler, notifications } = setUp();

    handler.handleError(
      new HttpErrorResponse({
        status: 422,
        error: {
          error: {
            code: 'VALIDATION_FAILED',
            message: 'invalid',
            details: { reason: ['A deferral reason is the office\'s own, never the family\'s.'] },
          },
        },
      }),
    );

    // Verbatim. A layer that rephrased these would be a second description of every validation
    // rule in the system, drifting from the one that actually refuses.
    expect(notifications.inbox()[0]?.body).toContain("A deferral reason is the office's own");
  });

});
