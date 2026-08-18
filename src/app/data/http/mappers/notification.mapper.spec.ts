import { toNotification } from './notification.mapper';

/** The published `GET me/notifications` payload, field for field. */
const WIRE = {
  id: 'ntf-0001',
  type: 'case.assigned',
  title: 'A request was assigned to you',
  body: 'TR-2026-000123 is now yours.',
  subject_type: 'assistance_request',
  subject_id: 'req-0001',
  priority: 'high',
  category: 'assignment',
  read_at: null,
  created_at: '2026-08-18T01:00:00Z',
};

describe('toNotification', () => {
  it('maps the published payload', () => {
    const notification = toNotification(WIRE);

    expect(notification?.id).toBe('ntf-0001');
    expect(notification?.title).toBe('A request was assigned to you');
    expect(notification?.kind).toBe('assignment');
    expect(notification?.readAt).toBeNull();
  });

  it('fixes the three fields this endpoint determines rather than sends', () => {
    // `me/notifications` items are inbox items for the caller by definition.
    // These are not guesses — they are what the endpoint is.
    const notification = toNotification(WIRE);

    expect(notification?.channel).toBe('inbox');
    expect(notification?.autoDismissMs).toBeNull();
    expect(notification?.recipientId).toBeNull();
  });

  it('turns the subject reference into somewhere to go', () => {
    expect(toNotification(WIRE)?.action).toEqual({ label: 'Open', routerLink: ['/requests', 'req-0001'] });
  });

  it('offers no link for a subject type it does not recognise', () => {
    // A link that 404s is worse than no link: the user concludes the record is
    // gone rather than that the console did not understand the reference.
    expect(toNotification({ ...WIRE, subject_type: 'something_new' })?.action).toBeNull();
  });

  it('does not raise an alarm for a priority it does not understand', () => {
    // An inbox that cries wolf on every unfamiliar type is an inbox people stop
    // reading, which is how the one real alert gets missed.
    expect(toNotification({ ...WIRE, priority: 'unheard-of' })?.severity).toBe('info');
    expect(toNotification({ ...WIRE, priority: 'critical' })?.severity).toBe('error');
    expect(toNotification({ ...WIRE, priority: 'high' })?.severity).toBe('warning');
  });

  it('falls back to the general kind rather than dropping the message', () => {
    expect(toNotification({ ...WIRE, category: 'invented-next-year' })?.kind).toBe('general');
  });

  it('drops an entry with no timestamp, which would sort as though it just arrived', () => {
    expect(toNotification({ ...WIRE, created_at: null })).toBeNull();
    expect(toNotification({ ...WIRE, id: undefined })).toBeNull();
    expect(toNotification(null)).toBeNull();
  });
});
