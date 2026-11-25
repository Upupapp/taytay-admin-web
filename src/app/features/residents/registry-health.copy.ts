import { WITHHOLDS_SMALL_COUNTS } from '@domain/index';

/** The words of the Citizens overview's additions and review-queue panels (`DL-249`). */
export const REGISTRY_HEALTH_COPY = {
  withheld: 'Withheld',

  addedHeading: 'Added to the registry',
  addedWindow: 'Last 12 months',
  addedCaption:
    'People on the registry now, by the month their record was added and how, last 12 months',
  addedMonthHeader: 'Month',
  addedOffice: 'Typed in at the office',
  addedImported: 'From an imported list',
  addedWithheld: (months: string) => `Withheld, below the small-cell threshold: ${months}.`,
  addedWithheldOffice: (month: string) => `${month}, typed in`,
  addedWithheldImported: (month: string) => `${month}, imported`,
  addedNote: WITHHOLDS_SMALL_COUNTS
    ? 'People on the registry now, by the month their record was added. A record an import matched to someone already listed added nobody. A figure below the small-cell threshold is withheld, never shown as zero.'
    : 'People on the registry now, by the month their record was added. A record an import matched to someone already listed added nobody.',

  queueHeading: 'ID review queue',
  queueLink: 'Open the queue',
  queueError: 'Could not load the review queue',
  queueRetry: 'Try again',
  queueWaiting: 'Waiting for a review',
  queueOldest: 'Oldest has waited',
  queueNoneWaiting: 'None waiting',
  queueDays: (days: number) =>
    days === 0 ? 'Less than a day' : days === 1 ? '1 day' : `${days} days`,
  queueDecided: 'Decided, last 7 days',
  queueDecidedValue: (approved: number, rejected: number) =>
    `${approved} approved, ${rejected} not accepted`,
  queueSentCaption: 'ID reviews sent by residents per day, last 7 days',
  queueNote:
    'Reviews of an ID sent from the app. A verification done in person at the office is not one. No review standard has been set, so a wait is counted in days, never as late.',
} as const;
