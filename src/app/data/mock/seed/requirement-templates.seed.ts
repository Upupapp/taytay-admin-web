import type { RequirementTemplate } from '@domain/index';

import { stamp } from './seed-utils';

/**
 * The shared document sets.
 *
 * Every AICS programme asked for the same three papers and each one spelled
 * them out again. One template means one code and one wording, so a waiver
 * recorded against `brgy-indigency` means the same thing in every report
 * (`DL-67`).
 */
export const MOCK_REQUIREMENT_TEMPLATES: readonly RequirementTemplate[] = [
  {
    code: 'aics-standard',
    name: 'AICS standard set',
    description:
      'The documents DSWD field practice expects for assistance to individuals in crisis situation. Programmes add their own evidence of the crisis on top.',
    requirements: [
      { code: 'valid-id', label: 'Valid government ID', isMandatory: true, notes: null },
      {
        code: 'brgy-indigency',
        label: 'Barangay certificate of indigency',
        isMandatory: true,
        notes: 'Issued within the last three months.',
      },
      {
        code: 'social-case-study',
        label: 'Social case study report',
        isMandatory: false,
        notes: 'Prepared by the assigned social worker; required above the counter ceiling.',
      },
    ],
    audit: stamp(240, 40),
  },
  {
    code: 'municipal-standard',
    name: 'Municipal programme set',
    description:
      'What the municipality asks for on programmes it runs and funds itself. Lighter than the AICS set: residency is verified from the registry rather than re-documented.',
    requirements: [
      { code: 'valid-id', label: 'Valid government ID', isMandatory: true, notes: null },
      {
        code: 'brgy-residency',
        label: 'Barangay certificate of residency',
        isMandatory: true,
        notes: 'Waived where the registry already records six months at the address.',
      },
    ],
    audit: stamp(240, 40),
  },
];
