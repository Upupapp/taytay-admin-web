import {
  asId,
  asIsoDate,
  type ProgramEnrollment,
  type ProgramEnrollmentId,
  type ProgramId,
  type ResidentId,
  type StaffUserId,
} from '@domain/index';

import { stamp } from './seed-utils';

const HEAD = asId<StaffUserId>('staff-head');

function enrollmentId(serial: number): ProgramEnrollmentId {
  return asId<ProgramEnrollmentId>(`enr-${String(serial).padStart(4, '0')}`);
}

/**
 * Standing programme membership.
 *
 * Deliberately sparse. Enrollment belongs to the *continuing* programmes — the
 * senior cash gift, solo-parent support, a livelihood cycle — and not to
 * one-off crisis assistance, where the request is the whole relationship. Most
 * residents in this seed have assistance history and no enrollment, which is
 * what the real registry looks like.
 *
 * Between them these records exercise every state the screens must handle: a
 * standing membership, a suspended one, an exit that completed, an exit that no
 * longer qualified, and a person who left and came back.
 */
export const MOCK_ENROLLMENTS: readonly ProgramEnrollment[] = [
  // Aurora Mercado — senior citizen, on the cash gift list since 2024.
  {
    id: enrollmentId(1),
    residentId: asId<ResidentId>('res-0001'),
    programId: asId<ProgramId>('prog-senior-cash'),
    programName: 'Senior Citizen Cash Gift',
    status: 'active',
    enrolledOn: asIsoDate('2024-02-12'),
    exit: null,
    continuesEnrollmentId: null,
    audit: stamp(536, 536),
  },
  // Elena Sarmiento — senior and PWD, enrolled more recently.
  {
    id: enrollmentId(2),
    residentId: asId<ResidentId>('res-0007'),
    programId: asId<ProgramId>('prog-senior-cash'),
    programName: 'Senior Citizen Cash Gift',
    status: 'active',
    enrolledOn: asIsoDate('2025-06-03'),
    exit: null,
    continuesEnrollmentId: null,
    audit: stamp(424, 424),
  },
  // Michelle Cordero — solo parent, currently on the support programme.
  {
    id: enrollmentId(3),
    residentId: asId<ResidentId>('res-0003'),
    programId: asId<ProgramId>('prog-solo-parent'),
    programName: 'Solo Parent Support',
    status: 'active',
    enrolledOn: asIsoDate('2025-09-15'),
    exit: null,
    continuesEnrollmentId: null,
    audit: stamp(320, 320),
  },
  // Danilo Estrella — completed a livelihood cycle. The exit is the point of
  // the programme, not a failure, and the record of it stays.
  {
    id: enrollmentId(4),
    residentId: asId<ResidentId>('res-0004'),
    programId: asId<ProgramId>('prog-livelihood'),
    programName: 'Livelihood Starter Kit',
    status: 'exited',
    enrolledOn: asIsoDate('2025-01-20'),
    exit: {
      reason: 'completed',
      exitedOn: asIsoDate('2025-11-28'),
      recordedBy: HEAD,
      note: 'Completed the ten-month cycle. Sari-sari store trading since September.',
    },
    continuesEnrollmentId: null,
    audit: stamp(558, 246),
  },
  // Marilou Bautista — 4Ps household. Suspended, not exited: the membership
  // stands while a compliance question is settled with the national programme.
  {
    id: enrollmentId(5),
    residentId: asId<ResidentId>('res-0009'),
    programId: asId<ProgramId>('prog-solo-parent'),
    programName: 'Solo Parent Support',
    status: 'suspended',
    enrolledOn: asIsoDate('2025-03-04'),
    exit: null,
    continuesEnrollmentId: null,
    audit: stamp(515, 61),
  },
  // Fernando Gonzales — left when his income rose, then came back when the work
  // ended. Two records, the second naming the first, so "how long was he on it?"
  // keeps one answer.
  {
    id: enrollmentId(6),
    residentId: asId<ResidentId>('res-0008'),
    programId: asId<ProgramId>('prog-livelihood'),
    programName: 'Livelihood Starter Kit',
    status: 'exited',
    enrolledOn: asIsoDate('2024-05-06'),
    exit: {
      reason: 'no-longer-qualified',
      exitedOn: asIsoDate('2025-02-14'),
      recordedBy: HEAD,
      note: 'Took regular work at a Taytay garments plant; household income above the threshold.',
    },
    continuesEnrollmentId: null,
    audit: stamp(453, 168),
  },
  {
    id: enrollmentId(7),
    residentId: asId<ResidentId>('res-0008'),
    programId: asId<ProgramId>('prog-livelihood'),
    programName: 'Livelihood Starter Kit',
    status: 'active',
    enrolledOn: asIsoDate('2026-04-09'),
    exit: null,
    continuesEnrollmentId: enrollmentId(6),
    audit: stamp(114, 114),
  },
];
