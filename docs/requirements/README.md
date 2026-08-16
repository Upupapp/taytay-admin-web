# Requirements, documents and verification

What an applicant must present, what they actually presented, and everything that
has ever stood in its place.

## The one thing to understand first

**A document is an append-only list of versions.** Replacing one marks the
previous version superseded — with a required reason — and adds a new one.
Nothing in the domain, the ports, either adapter or any screen removes a
version, and `npm run check:documents` fails the build if anything tries
(`DL-77`).

The superseded copy is the evidence of what the office actually read when it
made a decision. A request approved in March on a certificate that was replaced
in June has to stay explicable in December, and an overwriting model makes that
permanently unanswerable.

## Built on what already existed

TAB 14 extends the requirement model rather than adding a second one:

| Already there | From | What TAB 14 did |
| --- | --- | --- |
| `SubmittedRequirement` on `AssistanceRequest` | TAB 11 | Added obligation, applicability and the document |
| `reviewRequirement` on the port | TAB 11 | Kept; joined by four document operations |
| `RequirementTemplate` + `resolveRequirements` | TAB 12 (`DL-67`) | Unchanged — still the one place a shared document set is named |

There is no parallel document store and no second requirement model.

## Obligation: required, optional, conditional

`isMandatory` was a boolean until TAB 14. It could not express *"only if you are
claiming for a child"*, so such a document had to be recorded as required — and
every applicant who did not need it appeared to be missing one — or as optional,
and nobody chased it from the applicants who did.

A `conditional` requirement states its circumstances in `appliesWhen`, **in
words for a person to read**. The software never evaluates the condition
(`DL-76`). Applicability starts `undecided` and a staff member rules on it with a
recorded reason.

An **undecided conditional is not outstanding**. Nobody has said it applies, so
nothing is missing yet; it surfaces instead as a decision the office owes. That
distinction is why the state exists — assuming either way is the software
deciding somebody's circumstances.

`isOutstandingObligation` is the single derivation. Everything that used to read
`isMandatory` reads it, so a conditional document cannot be counted one way on a
checklist and another way in a report.

## Document states

Five requirement statuses became seven. `expired` and `needs-replacement` are
held apart from `rejected` because the applicant did nothing wrong: telling
somebody their certificate was "rejected" when it merely lapsed is inaccurate,
and needlessly bruising at a counter.

Validity is computed from the version's own dates:

| Validity | Means |
| --- | --- |
| `valid` | In force, more than 30 days to run |
| `expiring-soon` | Within the warning window (office convention, unconfirmed) |
| `expired` | Past its date |
| `no-expiry` | Genuinely does not expire |
| `unknown` | Nobody recorded an expiry |

The last two are deliberately distinct. Only one of them is somebody's
unfinished work.

## Sources, and when there is no file

| Source | Holds a file? |
| --- | --- |
| `uploaded`, `scanned` | Yes |
| `encoded` | No — details typed from a paper copy |
| `external-verification` | No — confirmed with the issuing office, no copy kept |

The office routinely verifies a document without keeping a copy. Inventing an
empty file for those cases would make "is there something to open?" a question
the screen has to guess at, so `documentVersionProblems` refuses a file on a
sourceless record and refuses a missing file on a source that should have one.

## Completion counts; it never decides

`RequirementCompletion` carries counts and nothing else — no `isComplete`, no
`isEligible`, no percentage promoted to a verdict (`DL-78`). `describeCompletion`
returns the sentence stating the boundary, from the domain rather than a
template, because a template is where such a sentence quietly gets shortened to
"Complete".

This is the fourth surface where a checklist could become an eligibility engine
(`DL-42`, `DL-60`, `DL-66`) and the one where the temptation is strongest,
because a complete checklist *looks* like a green light.

## Privacy

**Numbers are masked** to their last four characters by `maskDocumentNumber` —
enough for a clerk to confirm they are holding the right paper, not enough to
reconstruct an identifier. A number short enough that masking would reveal most
of it is masked whole. The full number needs `document.view-full-number`.

**Opening a file is a request, not a link.** `openDocument` returns a
`DocumentAccessGrant` — an opaque, short-lived handle plus the warning to show
first. There is no URL on the document model: a screen holding a link it may not
follow is one copy-paste from an unauthorised download.

The warning is composed by the data layer, not the client, because only the
server knows whether the record is handled under a protected sector. A warning
guessed client-side would be reassuring exactly when it should not be, and
sensitive records are marked `redactedForSharing` so a copy leaving the building
carries no more than the receiving office needs.

## Permissions

| Permission | Held by |
| --- | --- |
| `document.record` | Intake, social workers, MSWDO head, sysadmin |
| `document.download` | Social workers, MSWDO head, auditor, sysadmin |
| `document.view-full-number` | Social workers, MSWDO head, sysadmin |

**Intake records but does not download.** Recording what was presented and
pulling the scan itself are different disclosures, and the counter needs only
the first. The checker enforces this.

## Known gaps

- **Recording a document has no upload form yet.** The port, the adapter, the
  validation and the version history are all in place and tested; what is
  missing is the screen that captures a file. The document panel is read-only
  for now.
- **Document requests are modelled and seeded but not yet composed from the
  UI.** `requestDocument` works; the "ask the applicant" form is not built.
- **The redaction-ready preview is a flag, not a renderer.** `redactedForSharing`
  says a shared copy should be redacted; producing the redacted copy is backend
  work.
- **The expiry warning window is an office convention**, recorded as
  `EXPIRY_WARNING_BASIS` and unconfirmed against a written issuance in this
  offline run.
