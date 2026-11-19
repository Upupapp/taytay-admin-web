import {
  VULNERABILITY_FACTOR_CODES,
  type FactorState,
  type HouseholdMemberView,
  type VulnerabilityFactorCode,
} from '@domain/index';
import { VULNERABILITY_COPY } from '@shared/households/vulnerability.copy';

import { HOUSEHOLDS_COPY } from './households.copy';

/**
 * A household trail line as a social worker reads it.
 *
 * The domain names a member by id and a factor by its code (`household-audit.ts`), because a trail
 * line is composed once for every reader and a protected member's name is not every reader's
 * (`DL-38`). Printed as it came, the line said "added aacb7abd-… as child". Here, for this reader,
 * an id becomes the name the page already shows under Members — the disclosure-aware
 * `listedName`, so nothing is named that the Members list withholds — and a person no longer listed
 * is said in words, never by id. A factor code becomes its label.
 */
export function readableTrailSummary(
  summary: string,
  members: readonly HouseholdMemberView[],
): string {
  return summary
    .split('; ')
    .map((part) => readablePart(part, members))
    .join('; ');
}

const PERSON_LINES: readonly RegExp[] = [
  /^(added )(\S+)( as .+)$/,
  /^(removed )(\S+)()$/,
  /^(changed )(\S+)( to .+)$/,
  /^(made )(\S+)( the household head)$/,
];

const FACTOR_SET = /^set (\S+) to (\S+)$/;
const FACTOR_RESTORED = /^restored (\S+) to the computed value$/;

function readablePart(part: string, members: readonly HouseholdMemberView[]): string {
  for (const pattern of PERSON_LINES) {
    const match = pattern.exec(part);
    if (match) {
      const [, verb = '', id = '', rest = ''] = match;
      return `${verb}${personName(id, members)}${rest}`;
    }
  }
  const set = FACTOR_SET.exec(part);
  if (set) {
    const [, code = '', state = ''] = set;
    return `set ${factorName(code)} to ${stateName(state)}`;
  }
  const restored = FACTOR_RESTORED.exec(part);
  if (restored) {
    return `restored ${factorName(restored[1] ?? '')} to the computed value`;
  }
  return part;
}

function personName(id: string, members: readonly HouseholdMemberView[]): string {
  const member = members.find((entry) => entry.view.resident.id === id);
  return member ? member.view.listedName : HOUSEHOLDS_COPY.detail.trailFormerMember;
}

function factorName(code: string): string {
  const known = VULNERABILITY_FACTOR_CODES.find(
    (entry): entry is VulnerabilityFactorCode => entry === code,
  );
  return known ? `“${VULNERABILITY_COPY.factorLabel[known]}”` : code;
}

const STATES: readonly FactorState[] = ['present', 'absent', 'unknown', 'withheld'];

function stateName(state: string): string {
  const known = STATES.find((entry) => entry === state);
  return known ? `“${VULNERABILITY_COPY.stateLabel[known]}”` : state;
}
