# Rollback — console

TAB 12 step 6: *"Plan the rollback. The console is a static bundle; the fast reversal is
redeploying the previous build. Record the exact steps, the person who may take the decision, and
the maximum time to execute."*

## What makes this cheap

The console is **a static bundle with no server state**. It runs no migrations, holds no sessions
of its own, and writes nothing it would have to undo. Rolling it back is publishing an older set of
files — which is why the answer to almost every console incident is *reverse the deploy first, then
investigate*, rather than diagnosing under pressure.

**The API is not like this.** A backend rollback may involve data written under the newer version,
and nothing here applies to it.

## Who decides

| | |
| --- | --- |
| **May decide** | The MSWDO head, or the officer holding the deployment account. |
| **May execute** | Anyone with access to the hosting dashboard. |
| **Does not need** | A meeting. Reversing a static deploy is not a decision that improves with discussion — the previous build was working ten minutes ago. |

The decision to roll **forward** instead — to fix and redeploy — needs the same person, and should
be taken only when the fault is understood. "We think we know what it is" is a reason to roll back
and then find out.

## Steps

1. Open the hosting dashboard → **Deploys**.
2. Find the last deploy known good. Deploys are listed newest first with their commit.
3. **Publish deploy** on that entry.
4. Hard-reload the console and confirm the version it reports.
5. Confirm sign-in works and one list screen loads.

**Expected time: under five minutes**, dominated by steps 4–5 rather than by the publish.

`index.html` is served `no-store`, so the moment the old bundle is published the next request gets
it — there is no cache to wait out. That header is load-bearing for the rollback, not only for
freshness: with a cached `index.html`, a rollback would reach only the browsers that happened to
revalidate.

## What a rollback does not fix

* **An API fault.** The console reverting changes nothing about a backend returning 500s. Symptoms
  that look like the console — blank lists, failed saves — are frequently the API, and the
  difference is visible in the browser's network panel before any decision is taken.
* **A configuration fault in the deploy itself.** Rolling back to a build that was *also* misbuilt
  gets a working-looking console pointing at the wrong API. `check:environments` exists so that
  build never publishes.

## Not yet rehearsed

The command asks for *"a rollback executed once in staging and timed."* **This has not happened**,
because there is no staging environment. The steps above are written from the hosting model rather
than from a run, and the five-minute figure is an estimate, not a measurement.

**A rehearsal is a manual item.** It is also the cheapest of the outstanding ones: it needs a
staging site with two deploys and about fifteen minutes.
