import { inject, Injectable } from '@angular/core';
import { throwError, type Observable } from 'rxjs';

import {
  ACCESS_CONTEXT,
  actsOn,
  asId,
  asIsoDateTime,
  CARD_VALIDITY_DAYS,
  isPastExpiry,
  type AppAccountId,
  type DigitalIdCard,
  type DigitalIdHolder,
  type DigitalIdId,
  type DigitalIdRepository,
  type MediaId,
} from '@domain/index';

import { denyUnless } from './mock-access';
import { MockLatency } from './mock-latency';
import { MOCK_APP_ACCOUNTS } from './seed/app-accounts.seed';
import { samplePlaceholder } from './seed/verification-requests.seed';

/**
 * The prefix of every sample QR code the mock accepts, and a `check:bundle` seed marker. A sample
 * code is this followed by a card's id — `SAMPLE-QR.card-0001` — and is never a signed token.
 */
export const SAMPLE_QR_PREFIX = 'SAMPLE-QR.';

interface HeldCard {
  readonly account: AppAccountId;
  readonly card: DigitalIdCard;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function sampleCard(n: number, status: DigitalIdCard['status'], issued: string): DigitalIdCard {
  const issuedAt = new Date(issued);
  return {
    id: asId<DigitalIdId>(`card-${String(n).padStart(4, '0')}`),
    number: `TAY-SAMPLE-${String(n).padStart(6, '0')}`,
    photo: asId<MediaId>(`card-photo-${n}`),
    status,
    issuedAt: asIsoDateTime(issuedAt),
    expiresAt: asIsoDateTime(new Date(issuedAt.getTime() + CARD_VALIDITY_DAYS * DAY_MS)),
  };
}

/** Fictional cards for two of the seed's verified residents; the rest have none. */
const SEED: readonly HeldCard[] = [
  {
    account: asId<AppAccountId>('app-account-0004'),
    card: sampleCard(1, 'active', '2026-09-01T02:00:00.000Z'),
  },
  {
    account: asId<AppAccountId>('app-account-0007'),
    card: sampleCard(2, 'suspended', '2026-03-15T02:00:00.000Z'),
  },
];

/** The seed's cards as issued, for the mock dashboard's count of cards in force (`DL-182`). */
export const MOCK_SEED_DIGITAL_IDS: readonly DigitalIdCard[] = SEED.map((held) => held.card);

/**
 * Digital IDs for the `local-mock` configuration (`DL-171`), behaving as the API's handlers do: a
 * check re-checks `digital-id.verify` and every other act `digital-id.manage` (rule 4); only a
 * verified resident with no current card is issued one; suspend, revoke and reissue follow the
 * API's moves, and a revoked card is no longer anybody's current card.
 */
@Injectable()
export class MockDigitalIdRepository implements DigitalIdRepository {
  private readonly latency = inject(MockLatency);
  private readonly access = inject(ACCESS_CONTEXT);
  private cards: readonly HeldCard[] = SEED;
  private issued = SEED.length;

  check(payload: string): Observable<DigitalIdHolder> {
    const denied = denyUnless<DigitalIdHolder>(this.access.currentUser(), 'digital-id.verify');
    if (denied) return denied;

    const code = payload.trim();
    const held = code.startsWith(SAMPLE_QR_PREFIX)
      ? this.cards.find((entry) => entry.card.id === code.slice(SAMPLE_QR_PREFIX.length))
      : undefined;
    if (held === undefined) {
      return throwError(() => new Error('That QR code is not valid.'));
    }
    const account = MOCK_APP_ACCOUNTS.find((candidate) => candidate.id === held.account);

    return this.latency.respond({
      name: account?.name ?? null,
      photo: held.card.photo,
      status: held.card.status,
      expired: isPastExpiry(held.card),
      barangayName: 'San Isidro',
    });
  }

  cardOf(account: AppAccountId): Observable<DigitalIdCard | null> {
    const denied = denyUnless<DigitalIdCard | null>(this.access.currentUser(), 'digital-id.manage');
    if (denied) return denied;
    return this.latency.respond(this.current(account)?.card ?? null);
  }

  issue(account: AppAccountId): Observable<DigitalIdCard> {
    const denied = denyUnless<DigitalIdCard>(this.access.currentUser(), 'digital-id.manage');
    if (denied) return denied;

    const holder = MOCK_APP_ACCOUNTS.find((candidate) => candidate.id === account);
    if (holder === undefined) return throwError(() => new Error('That user was not found.'));
    if (holder.role !== 'verified') {
      return throwError(() => new Error('Only a verified resident can hold a digital ID.'));
    }
    if (this.current(account) !== null) {
      return throwError(() => new Error('That resident already has a digital ID.'));
    }
    const card = sampleCard(++this.issued, 'active', new Date().toISOString());
    this.cards = [...this.cards, { account, card }];
    return this.latency.respond(card);
  }

  suspend(card: DigitalIdId): Observable<DigitalIdCard> {
    return this.move(card, 'suspend', 'suspended', 'That digital ID cannot be suspended.');
  }

  revoke(card: DigitalIdId): Observable<DigitalIdCard> {
    return this.move(card, 'revoke', 'revoked', 'That digital ID cannot be revoked.');
  }

  reissue(card: DigitalIdId): Observable<DigitalIdCard> {
    const denied = denyUnless<DigitalIdCard>(this.access.currentUser(), 'digital-id.manage');
    if (denied) return denied;

    const held = this.cards.find((entry) => entry.card.id === card);
    if (held === undefined) return throwError(() => new Error('That digital ID was not found.'));
    const holder = MOCK_APP_ACCOUNTS.find((candidate) => candidate.id === held.account);
    if (holder?.role !== 'verified') {
      return throwError(() => new Error('Only a verified resident can hold a digital ID.'));
    }
    const other = this.current(held.account);
    if (other !== null && other.card.id !== card) {
      return throwError(() => new Error('That resident already has a digital ID.'));
    }

    const replacement: DigitalIdCard = {
      ...sampleCard(++this.issued, 'active', new Date().toISOString()),
      photo: held.card.photo,
    };
    const revoked: DigitalIdCard = { ...held.card, status: 'revoked' };
    this.cards = [
      ...this.cards.map((entry) => (entry.card.id === card ? { ...entry, card: revoked } : entry)),
      { account: held.account, card: replacement },
    ];
    return this.latency.respond(replacement);
  }

  openPhoto(photo: MediaId): Observable<Blob> {
    // Staff open a checked card's photo; an administrator, a kept card's. Either key reads it.
    const user = this.access.currentUser();
    const denied =
      denyUnless<Blob>(user, 'digital-id.manage') && denyUnless<Blob>(user, 'digital-id.verify');
    if (denied) return denied;
    if (!this.cards.some((entry) => entry.card.photo === photo)) {
      return throwError(() => new Error('That photo was not found.'));
    }
    return this.latency.respond(samplePlaceholder('selfie'));
  }

  private current(account: AppAccountId): HeldCard | null {
    return (
      this.cards.find((entry) => entry.account === account && entry.card.status !== 'revoked') ??
      null
    );
  }

  private move(
    card: DigitalIdId,
    act: 'suspend' | 'revoke',
    status: 'suspended' | 'revoked',
    refusal: string,
  ): Observable<DigitalIdCard> {
    const denied = denyUnless<DigitalIdCard>(this.access.currentUser(), 'digital-id.manage');
    if (denied) return denied;

    const held = this.cards.find((entry) => entry.card.id === card);
    if (held === undefined) return throwError(() => new Error('That digital ID was not found.'));
    if (!actsOn(held.card).includes(act)) return throwError(() => new Error(refusal));

    const moved = { ...held.card, status };
    this.cards = this.cards.map((entry) =>
      entry.card.id === card ? { ...entry, card: moved } : entry,
    );
    return this.latency.respond(moved);
  }
}
