import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import { AuthTokenHolder } from '@core/auth/auth-token.holder';
import { apiHeadersInterceptor } from '@core/http/api.interceptors';
import {
  REGISTRANT_EXPORT_NOTICE,
  asId,
  asIsoDateTime,
  type BarangayId,
  type EventDraft,
  type EventRegistrationId,
  type LguEventId,
  type MediaId,
} from '@domain/index';

import OFFICE_EVENT from './fixtures/office-event.json';
import OFFICE_EVENT_CAPACITY from './fixtures/office-event-capacity.json';
import OFFICE_EVENT_CHECK_IN from './fixtures/office-event-check-in.json';
import OFFICE_EVENT_EXPORT from './fixtures/office-event-export.json';
import OFFICE_EVENT_HISTORY from './fixtures/office-event-history.json';
import OFFICE_EVENT_METRICS from './fixtures/office-event-metrics.json';
import OFFICE_EVENT_REGISTRANT from './fixtures/office-event-registrant.json';
import OFFICE_EVENT_REGISTRANTS from './fixtures/office-event-registrants.json';
import OFFICE_EVENTS from './fixtures/office-events.json';
import MEDIA from './fixtures/media.json';
import { HttpEventRepository } from './http-repositories';

const BASE = 'https://api.example.gov.ph/api/v1';
const DOLORES_API = '0b1c2d3e-4f50-4a61-8b72-3c4d5e6f7a01';
/** `GET barangays`: the API knows each barangay by its own id, joined to the console’s by name. */
const BARANGAYS = {
  data: [
    { id: DOLORES_API, code: 'dolores', name: 'Dolores' },
    { id: '0b1c2d3e-4f50-4a61-8b72-3c4d5e6f7a02', code: 'muzon', name: 'Muzon' },
  ],
  meta: {},
};
const MISSION = asId<LguEventId>('5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a01');
const WAITLISTED = asId<EventRegistrationId>('6f7a8b9c-0d1e-4f2a-8b3c-4d5e6f7a8b03');
const EVENTS = `${BASE}/office/events`;

const providers = [
  provideHttpClient(withInterceptors([apiHeadersInterceptor])),
  provideHttpClientTesting(),
  {
    provide: APP_ENVIRONMENT,
    useValue: { apiBaseUrl: BASE, dataSource: 'http', firebaseWebApiKey: 'test-web-api-key' },
  },
  HttpEventRepository,
];

/** A deep copy of a fixture, to plant one thing in. */
const copy = <T>(value: T): T => structuredClone(value);

function draft(overrides: Partial<EventDraft> = {}): EventDraft {
  return {
    title: 'Feeding programme — Dolores',
    summary: '',
    details: '',
    category: 'feeding-programme',
    image: null,
    startsAt: asIsoDateTime('2026-12-01T01:00:00.000Z'),
    endsAt: asIsoDateTime('2026-12-01T04:00:00.000Z'),
    venue: { name: '', address: '', mapUrl: null, barangayId: asId<BarangayId>('brgy-dolores') },
    contact: { name: '', office: '', phone: null },
    registration: {
      isRequired: true,
      opensAt: null,
      closesAt: null,
      capacity: 40,
      safeLimit: null,
      waitlistEnabled: true,
      eligibility: 'verified-residents',
      givesOutBenefit: true,
      participationNote: null,
    },
    reminders: null,
    ...overrides,
  };
}

/**
 * Events over the API (`DL-192`). The server keeps the events, takes residents' registrations in
 * its own row lock and stamps its own counts; the adapter asks with named keys, refuses an empty
 * reason without a request, and the mapper holds a registrant to the closed set.
 */
describe('events over the API (DL-192)', () => {
  let http: HttpTestingController;
  let repository: HttpEventRepository;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthTokenHolder).hold('fixture-token', null);
    repository = TestBed.inject(HttpEventRepository);
  });

  afterEach(() => http.verify());

  const barangays = () => {
    for (const pending of http.match(`${BASE}/barangays`)) {
      pending.flush(BARANGAYS);
    }
  };

  describe('reading', () => {
    it('asks for one view with named keys, and places a venue by the console’s barangay', async () => {
      const read = firstValueFrom(
        repository.list('upcoming', { search: '  mission ', category: 'medical-mission' }),
      );
      barangays();
      const request = http.expectOne((candidate) => candidate.url === EVENTS);
      expect(request.request.method).toBe('GET');
      expect(request.request.params.get('view')).toBe('upcoming');
      expect(request.request.params.get('q')).toBe('mission');
      expect(request.request.params.get('category')).toBe('medical-mission');
      expect(request.request.params.has('from')).toBe(false);
      request.flush(OFFICE_EVENTS);
      const events = await read;

      expect(events).toHaveLength(3);
      const [mission, calledOff, unfinished] = events;
      expect(mission?.venue.barangayId).toBe('brgy-dolores');
      expect(mission?.registeredCount).toBe(2);
      expect(mission?.image?.altText).toContain('poster');
      // The stored image, never the residents' public address (`DL-193`).
      expect(mission?.image).toEqual({
        mediaId: '7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e41',
        altText: 'A poster: free check-ups at the Dolores covered court, Saturday morning.',
      });
      // Nothing records that one event replaces another, so nothing is invented.
      expect(mission?.replacesEventId).toBeNull();
      expect(calledOff?.cancellationReason).toContain('supplies');
      expect(unfinished?.summary).toBe('');
      expect(unfinished?.publishedBy).toBeNull();
    });

    it('sends no search for a blank one, and reads a missing event as none', async () => {
      const listed = firstValueFrom(repository.list('drafts', { search: '   ' }));
      barangays();
      const request = http.expectOne((candidate) => candidate.url === EVENTS);
      expect(request.request.params.has('q')).toBe(false);
      request.flush({ data: [], meta: {} });
      expect(await listed).toEqual([]);

      const found = firstValueFrom(repository.getById(MISSION));
      barangays();
      http
        .expectOne(`${EVENTS}/${MISSION}`)
        .flush(
          { error: { code: 'NOT_FOUND', message: 'There is no such event.' } },
          { status: 404, statusText: 'Not Found' },
        );
      expect(await found).toBeNull();
    });

    it('refuses the whole list when one row cannot be read, rather than showing one fewer', async () => {
      const broken = copy(OFFICE_EVENTS);
      (broken.data[1] as Record<string, unknown>)['registered_count'] = 'two';
      const read = firstValueFrom(repository.list('upcoming', {}));
      barangays();
      http.expectOne((candidate) => candidate.url === EVENTS).flush(broken);
      await expect(read).rejects.toThrow(/could not be read whole/);
    });

    it('takes the moment from the server, and gives a rate only once attendance is final', async () => {
      const capacity = firstValueFrom(repository.capacity(MISSION));
      http.expectOne(`${EVENTS}/${MISSION}/capacity`).flush(OFFICE_EVENT_CAPACITY);
      const summary = await capacity;
      expect(summary.asOf).toBe('2026-11-08T02:00:00.000Z');
      expect(summary.cancelledCount).toBe(1);
      expect(Object.keys(summary)).not.toContain('hasRoom');

      const open = firstValueFrom(repository.metrics(MISSION));
      http.expectOne(`${EVENTS}/${MISSION}/metrics`).flush(OFFICE_EVENT_METRICS);
      expect((await open).attendanceRate).toBeNull();

      const final = copy(OFFICE_EVENT_METRICS);
      final.data.attendance_final = true;
      const closed = firstValueFrom(repository.metrics(MISSION));
      http.expectOne(`${EVENTS}/${MISSION}/metrics`).flush(final);
      expect((await closed).attendanceRate).toBe(0.5);
    });
  });

  describe('registrants', () => {
    it('reads the closed set, with no notes and nobody’s account id', async () => {
      const read = firstValueFrom(
        repository.registrants(MISSION, { status: 'waitlisted', search: 'Cruz' }),
      );
      barangays();
      const request = http.expectOne(
        (candidate) => candidate.url === `${EVENTS}/${MISSION}/registrants`,
      );
      expect(request.request.params.get('status')).toBe('waitlisted');
      expect(request.request.params.get('q')).toBe('Cruz');
      request.flush(OFFICE_EVENT_REGISTRANTS);
      const rows = await read;

      expect(rows).toHaveLength(4);
      expect(rows[0]?.barangayId).toBe('brgy-dolores');
      for (const row of rows) {
        expect(row.notes).toBeNull();
        expect(Object.keys(row).sort()).toEqual([
          'attendance',
          'barangayId',
          'displayName',
          'id',
          'identityVerified',
          'nameSource',
          'notes',
          'reference',
          'registeredAt',
          'status',
        ]);
      }
    });

    it('refuses a row that carries more than the closed set, rather than trimming it', async () => {
      const wider = copy(OFFICE_EVENT_REGISTRANTS);
      (wider.data[0] as Record<string, unknown>)['resident_id'] =
        '9a0b1c2d-3e4f-4a5b-8c6d-7e8f9a0b1c09';
      const read = firstValueFrom(repository.registrants(MISSION, {}));
      barangays();
      http
        .expectOne((candidate) => candidate.url === `${EVENTS}/${MISSION}/registrants`)
        .flush(wider);
      await expect(read).rejects.toThrow(/could not be read whole/);
    });

    it('moves a place with its reason and reads back what the server made of it', async () => {
      const moved = firstValueFrom(
        repository.actOnRegistration(
          MISSION,
          WAITLISTED,
          'promote',
          '  A family travelled two hours. ',
        ),
      );
      barangays();
      const request = http.expectOne(`${EVENTS}/${MISSION}/registrations/${WAITLISTED}/promote`);
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual({ reason: 'A family travelled two hours.' });
      request.flush({ data: { ...OFFICE_EVENT_REGISTRANT.data, status: 'registered' }, meta: {} });
      expect((await moved).status).toBe('registered');
    });

    it('marks attendance by hand, with nothing else in the body', async () => {
      const marked = firstValueFrom(repository.markAttendance(MISSION, WAITLISTED, 'attended'));
      barangays();
      const request = http.expectOne(`${EVENTS}/${MISSION}/registrations/${WAITLISTED}/attendance`);
      expect(request.request.body).toEqual({ attendance: 'attended' });
      request.flush({
        data: { ...OFFICE_EVENT_REGISTRANT.data, attendance: 'attended' },
        meta: {},
      });
      expect((await marked).attendance).toBe('attended');
    });

    it('takes the file the server composed, and refuses one without its conditions', async () => {
      const exported = firstValueFrom(repository.exportRegistrants(MISSION));
      http.expectOne(`${EVENTS}/${MISSION}/registrants/export`).flush(OFFICE_EVENT_EXPORT);
      const file = await exported;
      expect(file.manifest.handlingNotice).toBe(REGISTRANT_EXPORT_NOTICE);
      expect(file.manifest.rowCount).toBe(4);
      expect(file.content).toContain(REGISTRANT_EXPORT_NOTICE);

      const bare = copy(OFFICE_EVENT_EXPORT);
      bare.data.content = bare.data.content.replace(REGISTRANT_EXPORT_NOTICE, 'Handle with care.');
      const refused = firstValueFrom(repository.exportRegistrants(MISSION));
      http.expectOne(`${EVENTS}/${MISSION}/registrants/export`).flush(bare);
      await expect(refused).rejects.toThrow(/could not be read whole/);
    });
  });

  describe('acting', () => {
    it('saves a draft whole, the venue by the API’s barangay, and edits one by PATCH', async () => {
      const created = firstValueFrom(repository.saveDraft(draft(), null));
      barangays();
      const post = http.expectOne(EVENTS);
      expect(post.request.method).toBe('POST');
      expect(post.request.body).toMatchObject({
        title: 'Feeding programme — Dolores',
        venue_barangay_id: DOLORES_API,
        starts_at: '2026-12-01T01:00:00.000Z',
        capacity: 40,
        waitlist_enabled: true,
        image_media_id: null,
        image_alt_text: null,
        venue_map_url: null,
      });
      expect(Object.keys(post.request.body as object)).toHaveLength(25);
      expect(post.request.body).not.toHaveProperty('image_url');
      post.flush(OFFICE_EVENT);
      expect((await created).id).toBe(MISSION);

      const edited = firstValueFrom(
        repository.saveDraft(draft({ title: 'Feeding programme' }), MISSION),
      );
      barangays();
      const patch = http.expectOne(`${EVENTS}/${MISSION}`);
      expect(patch.request.method).toBe('PATCH');
      patch.flush(OFFICE_EVENT);
      await edited;
    });

    it('stores a chosen cover through POST media first, then names it with its description', async () => {
      const file = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], {
        type: 'image/png',
      });
      const created = firstValueFrom(
        repository.saveDraft(
          draft({
            image: { kind: 'chosen', file, altText: '  Volunteers at the covered court.  ' },
          }),
          null,
        ),
      );
      barangays();
      const upload = http.expectOne({ method: 'POST', url: `${BASE}/media` });
      expect(upload.request.body).toBeInstanceOf(FormData);
      // FormData hands a Blob back as a File of the same bytes.
      const sent = upload.request.body instanceof FormData ? upload.request.body.get('file') : null;
      expect(sent instanceof Blob ? [sent.size, sent.type] : null).toEqual([file.size, file.type]);
      upload.flush(MEDIA, { status: 201, statusText: 'Created' });

      const post = http.expectOne({ method: 'POST', url: EVENTS });
      expect(post.request.body).toMatchObject({
        image_media_id: MEDIA.data.id,
        image_alt_text: 'Volunteers at the covered court.',
      });
      expect(post.request.body).not.toHaveProperty('image_url');
      post.flush(OFFICE_EVENT, { status: 201, statusText: 'Created' });
      await created;
    });

    it('names a stored cover again without uploading it, and reads any cover through media', async () => {
      const stored = asId<MediaId>('7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e41');
      const saved = firstValueFrom(
        repository.saveDraft(
          draft({ image: { kind: 'stored', mediaId: stored, altText: 'A poster.' } }),
          MISSION,
        ),
      );
      barangays();
      http.expectNone(`${BASE}/media`);
      const patch = http.expectOne({ method: 'PATCH', url: `${EVENTS}/${MISSION}` });
      expect(patch.request.body).toMatchObject({
        image_media_id: stored,
        image_alt_text: 'A poster.',
      });
      patch.flush(OFFICE_EVENT);
      const event = await saved;

      // The bearer travels in a header; a draft's cover is read the same way (`DL-193`).
      const bytes = firstValueFrom(repository.coverImage(event));
      const read = http.expectOne(`${BASE}/media/${stored}/content`);
      expect(read.request.method).toBe('GET');
      expect(read.request.responseType).toBe('blob');
      read.flush(new Blob(['png']));
      expect(await bytes).toBeInstanceOf(Blob);

      await expect(
        firstValueFrom(repository.coverImage({ ...event, image: null })),
      ).rejects.toThrow('no cover');
    });

    it('sends nothing, not even the image, for a draft the domain refuses', async () => {
      const file = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' });
      await expect(
        firstValueFrom(
          repository.saveDraft(
            draft({ startsAt: null, endsAt: null, image: { kind: 'chosen', file, altText: '' } }),
            null,
          ),
        ),
      ).rejects.toThrow('Choose when it starts.');
      http.expectNone(`${BASE}/media`);
    });

    it('sends nothing for a draft with no dates or a barangay the API does not know', async () => {
      await expect(
        firstValueFrom(repository.saveDraft(draft({ startsAt: null, endsAt: null }), null)),
      ).rejects.toThrow('Choose when it starts.');

      const unknown = firstValueFrom(
        repository.saveDraft(
          draft({
            venue: {
              name: '',
              address: '',
              mapUrl: null,
              barangayId: asId<BarangayId>('brgy-atlantis'),
            },
          }),
          null,
        ),
      );
      barangays();
      await expect(unknown).rejects.toThrow(/barangay/);
    });

    it('sends every move with its reason, and refuses an empty one without a request', async () => {
      for (const act of ['publish', 'cancel', 'complete', 'archive'] as const) {
        await expect(firstValueFrom(repository[act](MISSION, '   '))).rejects.toThrow(
          /needs a reason/,
        );
        const moved = firstValueFrom(repository[act](MISSION, ` Approved at the ${act} meeting. `));
        barangays();
        const request = http.expectOne(`${EVENTS}/${MISSION}/${act}`);
        expect(request.request.body).toEqual({ reason: `Approved at the ${act} meeting.` });
        request.flush(OFFICE_EVENT);
        await moved;
      }
      await expect(
        firstValueFrom(repository.actOnRegistration(MISSION, WAITLISTED, 'cancel', '')),
      ).rejects.toThrow(/needs a reason/);
    });
  });

  describe('corrections, check-in and who may register (DL-195)', () => {
    it('reads who may register, whether it gives something out, and the safe limit', async () => {
      const read = firstValueFrom(repository.getById(MISSION));
      barangays();
      http.expectOne(`${EVENTS}/${MISSION}`).flush({
        data: {
          ...OFFICE_EVENT.data,
          safe_limit: 230,
          registration_eligibility: 'verified-residents',
          gives_out_benefit: true,
        },
        meta: {},
      });
      const event = await read;
      expect(event?.registration.safeLimit).toBe(230);
      expect(event?.registration.eligibility).toBe('verified-residents');
      expect(event?.registration.givesOutBenefit).toBe(true);
    });

    it('refuses an event whose eligibility it does not know, rather than guessing', async () => {
      const read = firstValueFrom(repository.getById(MISSION));
      barangays();
      http
        .expectOne(`${EVENTS}/${MISSION}`)
        .flush({ data: { ...OFFICE_EVENT.data, registration_eligibility: 'everyone' }, meta: {} });
      await expect(read).rejects.toThrow(/could not be read whole/);
    });

    it('sends a correction whole, with its reason and whether to tell residents', async () => {
      const corrected = firstValueFrom(
        repository.correct(
          MISSION,
          draft({
            summary: 'Hot meals for enrolled children.',
            venue: {
              name: 'Taytay municipal gym',
              address: 'Rizal Ave., San Juan, Taytay, Rizal',
              mapUrl: null,
              barangayId: asId<BarangayId>('brgy-dolores'),
            },
            contact: { name: 'MSWDO front desk', office: 'MSWDO', phone: null },
          }),
          { reason: '  The court is under repair. ', tellRegistrants: true },
        ),
      );
      barangays();
      const request = http.expectOne(`${EVENTS}/${MISSION}/correct`);
      expect(request.request.method).toBe('POST');
      const body = request.request.body as Record<string, unknown>;
      expect(body['reason']).toBe('The court is under repair.');
      expect(body['tell_registrants']).toBe(true);
      expect(body['venue_name']).toBe('Taytay municipal gym');
      expect(body['venue_barangay_id']).toBe(DOLORES_API);
      expect(body['safe_limit']).toBeNull();
      expect(body['registration_eligibility']).toBe('verified-residents');
      expect(body['gives_out_benefit']).toBe(true);
      request.flush(OFFICE_EVENT);
      expect((await corrected).id).toBe(MISSION);
    });

    it('refuses a correction with no reason, or one that would not publish, without a request', async () => {
      const filled = draft({
        summary: 'Hot meals.',
        venue: { name: 'Gym', address: 'Rizal Ave., Taytay', mapUrl: null, barangayId: null },
        contact: { name: 'Desk', office: 'MSWDO', phone: null },
      });
      await expect(
        firstValueFrom(
          repository.correct(MISSION, filled, { reason: ' ', tellRegistrants: false }),
        ),
      ).rejects.toThrow(/needs a reason/);
      await expect(
        firstValueFrom(
          repository.correct(MISSION, draft(), { reason: 'Fixing it.', tellRegistrants: false }),
        ),
      ).rejects.toThrow(/one line residents see/);
    });

    it('finds one registrant at the door and never asks for the list', async () => {
      const found = firstValueFrom(repository.checkIn(MISSION, '  ana reyes '));
      barangays();
      const request = http.expectOne(
        (candidate) => candidate.url === `${EVENTS}/${MISSION}/check-in`,
      );
      expect(request.request.method).toBe('GET');
      expect(request.request.params.get('q')).toBe('ana reyes');
      request.flush(OFFICE_EVENT_CHECK_IN);
      const lookup = await found;
      expect(lookup.matches.map((row) => row.reference)).toEqual(['ER-2026-000001']);
      expect(lookup.moreMatches).toBe(false);
      await expect(firstValueFrom(repository.checkIn(MISSION, 'a'))).rejects.toThrow(/two letters/);
    });

    it('marks a registrant nobody ID-checked, and where each name comes from', async () => {
      const read = firstValueFrom(repository.registrants(MISSION, {}));
      barangays();
      http
        .expectOne((candidate) => candidate.url === `${EVENTS}/${MISSION}/registrants`)
        .flush(OFFICE_EVENT_REGISTRANTS);
      const rows = await read;
      const last = rows[rows.length - 1];
      expect(rows[0]?.identityVerified).toBe(true);
      expect(rows[0]?.nameSource).toBe('id-approval');
      expect(last?.identityVerified).toBe(false);
      expect(last?.nameSource).toBe('account');
    });

    it('reads a name the office corrected against an ID as its own source (DL-198)', async () => {
      const read = firstValueFrom(repository.registrants(MISSION, {}));
      barangays();
      const [first, ...rest] = OFFICE_EVENT_REGISTRANTS.data;
      http
        .expectOne((candidate) => candidate.url === `${EVENTS}/${MISSION}/registrants`)
        .flush({
          ...OFFICE_EVENT_REGISTRANTS,
          data: [{ ...first, name_source: 'office-correction' }, ...rest],
        });
      const rows = await read;
      expect(rows[0]?.nameSource).toBe('office-correction');
    });
  });

  it('reads the history as the office’s acts, each with its reason and no recorded fields', async () => {
    const read = firstValueFrom(repository.history(MISSION));
    http.expectOne(`${EVENTS}/${MISSION}/history`).flush(OFFICE_EVENT_HISTORY);
    const rows = await read;

    expect(rows.map((row) => row.action)).toEqual(['registration-changed', 'published', 'created']);
    expect(rows[0]?.reason).toContain('travelled two hours');
    expect(rows[0]?.summary).not.toContain('Ben');
    expect(rows[2]?.reason).toBeNull();
    for (const row of rows) {
      expect(row.entityId).toBe(MISSION);
      expect(row.fieldsRecorded).toBe(false);
      expect(row.source).toBe('api');
    }
  });
});
