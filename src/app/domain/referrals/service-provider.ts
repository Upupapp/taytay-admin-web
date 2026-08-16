import type { AuditStamp } from '../shared/audit';
import type { BarangayId, ServiceProviderId } from '../shared/ids';
import type { ReferralDestination } from './referral';

/**
 * The offices, hospitals and partners the MSWDO refers people to.
 *
 * A directory rather than a free-text field, for a reason that shows up at a
 * counter: "PhilHealth Rizal", "Philhealth - Rizal" and "PHIC Rizal" are three
 * spellings of one office, and once they exist an applicant cannot be told
 * whether anybody has heard back, and a report on referral outcomes counts one
 * destination three ways.
 *
 * The directory also carries **what each provider actually accepts**, so a
 * referral is not sent to an office that does not do this work — which costs the
 * family a trip they cannot afford.
 */

export type ServiceProviderStatus = 'active' | 'suspended' | 'retired';

export const SERVICE_PROVIDER_STATUS_LABELS: Readonly<Record<ServiceProviderStatus, string>> = {
  active: 'Accepting referrals',
  suspended: 'Temporarily not accepting',
  retired: 'No longer used',
};

/**
 * How a referral reaches them. Recorded because it decides what the office can
 * promise: a referral relayed on paper cannot be chased by phone the same day.
 */
export type ReferralChannel = 'letter' | 'email' | 'phone' | 'in-person' | 'system';

export const REFERRAL_CHANNEL_LABELS: Readonly<Record<ReferralChannel, string>> = {
  letter: 'Printed letter',
  email: 'Email',
  phone: 'Phone',
  'in-person': 'Hand-carried by the client',
  system: 'Inter-office system',
};

export interface ProviderContact {
  readonly personName: string | null;
  readonly position: string | null;
  readonly phone: string | null;
  readonly email: string | null;
}

export interface ServiceProvider {
  readonly id: ServiceProviderId;
  readonly name: string;
  readonly destination: ReferralDestination;
  readonly status: ServiceProviderStatus;
  /** What this office actually does, in the words staff would use. */
  readonly servicesOffered: readonly string[];
  readonly address: string | null;
  readonly barangayId: BarangayId | null;
  readonly contact: ProviderContact;
  readonly channels: readonly ReferralChannel[];
  /**
   * How long the office usually waits before chasing. Feeds the default
   * follow-up date, and is the office's own convention rather than a promise
   * the provider made.
   */
  readonly usualResponseDays: number | null;
  readonly notes: string | null;
  readonly audit: AuditStamp;
}

export function isAcceptingReferrals(provider: ServiceProvider): boolean {
  return provider.status === 'active';
}

export interface ServiceProviderFilter {
  readonly search?: string;
  readonly destination?: ReferralDestination;
  readonly status?: ServiceProviderStatus;
}

/**
 * A provider is usable when it is accepting referrals and the office knows how
 * to reach it. A directory entry with no channel and no contact is a name, and
 * sending to it produces a referral nobody can follow up.
 */
export function providerProblems(provider: ServiceProvider): readonly string[] {
  const problems: string[] = [];

  if (provider.name.trim().length === 0) {
    problems.push('provider-needs-a-name');
  }
  if (provider.channels.length === 0) {
    problems.push('provider-needs-a-channel');
  }
  if (
    provider.contact.phone === null &&
    provider.contact.email === null &&
    provider.address === null
  ) {
    problems.push('provider-needs-a-way-to-reach-it');
  }
  if (provider.servicesOffered.length === 0) {
    problems.push('provider-needs-a-service');
  }

  return problems;
}
