export const meta = {
  name: 'issue',
  description: 'Work one issue in stages that stop for the owner: scope (before evidence, plan) or build (fix, after evidence, checks, PR draft)',
  whenToUse: 'The owner names an issue to attack. args: {issue: <number>, stage: "scope" | "build", part?: "<name of a second PR for the same issue>", notes?: "<the owner\'s reactions, verbatim>"}. Run scope, show the brief and wait; run build with the owner\'s notes, show the draft and wait; build again for more notes. Shipping (push, evidence, PR) is done by the main session on the owner\'s word, never here.',
  phases: [
    { title: 'Scope', detail: 'read the issue, reproduce, record the before evidence, plan' },
    { title: 'Challenge', detail: 'an independent critic checks the brief against the code and the decisions' },
    { title: 'Build', detail: 'fix on the branch, record the after evidence, run the checks, draft the PR' },
    { title: 'Review', detail: 'an adversarial review of the diff, the evidence and the draft; one round of fixes' },
  ],
}

const n = Number(args?.issue)
const stage = args?.stage ?? 'scope'
const notes = (args?.notes ?? '').trim()
if (!n) throw new Error('args.issue (a number) is required')
if (!['scope', 'build'].includes(stage)) throw new Error('args.stage is "scope" or "build"')

// A second PR for the same issue (args.part, e.g. "layout") gets its own evidence folder and branch
const part = args?.part ? String(args.part) : ''
const dir = `.evidence/${n}${part ? '-' + part : ''}`

// What every agent here must hold to, beyond CLAUDE.md
const RULES = `
Rules for this run (issue #${n}; the owner reviews from the PR page alone):
- Work in the main checkout, on the dev stack (docker compose -f docker-compose.yml -f docker-compose.dev.yml; frontend :5173 hot-reloads from this tree). Start it if it is down.
- Nothing outward-facing: never git push, never create or comment on issues or PRs (gh is read-only for you), never touch piserve. The owner decides that after reading your result.
- Never commit backend/data.json (dev-only changes), .evidence/ or .playwright-mcp/. Never git add . or -A; add files by name. Commits: <type>(<scope>): <subject>, ending with the two attribution lines the session uses (Co-Authored-By and Claude-Session, as in git log -1 on master).
- Evidence lives in ${dir}/ (git-ignored). Record it with tools/evidence (read its README first): a scenario .mjs, tools/evidence/record.sh to play it (screenshots + mp4 with sound), tools/evidence/dev.sh to set the scene. Kiosk size 1280×800, plus any size the change affects. Look at every screenshot you cite (Read the .png) and say what it shows; don't cite evidence you haven't looked at.
- If a scene changes backend/data.json (directly or through the admin API, which rewrites it reformatted and root-owned), copy it aside first and put it back byte for byte and owned by your user at the end (rm, then cp from the copy); check with cmp.
- Don't use the flow skill (you are a subagent).
- The decisions on the tracker #51 are settled; don't reopen them.
- A PR that only does part of an issue says "Part of #${n}" and nowhere uses close, closes, fix, fixes, resolve or resolves next to an issue number: GitHub closes the issue on merge for any of them, even in a sentence about a later PR.
`

const BRIEF = {
  type: 'object',
  properties: {
    branch: { type: 'string', description: 'issue-<n>-<slug> (issue-<n>-<part>-<slug> for a part), created from master' },
    title: { type: 'string' },
    problem: { type: 'string', description: 'What goes wrong, as the owner would see it, 2-3 sentences' },
    cause: { type: 'string', description: 'Why, with file:line' },
    before: { type: 'array', items: { type: 'object', properties: { file: { type: 'string' }, shows: { type: 'string' } }, required: ['file', 'shows'] }, description: 'Evidence files in the evidence dir and what each shows' },
    plan: { type: 'array', items: { type: 'string' }, description: 'The fix, step by step, with the files' },
    blastRadius: { type: 'array', items: { type: 'string' }, description: 'Other screens, owl tours and clips, sounds, schemas/migrations, stars, piserve steps' },
    mark: { type: 'string', description: 'What decision gets recorded, and where (CLAUDE.md section or a README)' },
    questions: { type: 'array', items: { type: 'string' }, description: 'Choices that are the owner\'s to make, each with your recommendation' },
  },
  required: ['branch', 'title', 'problem', 'cause', 'before', 'plan', 'blastRadius', 'mark', 'questions'],
}

const CRITIQUE = {
  type: 'object',
  properties: {
    sound: { type: 'boolean', description: 'The brief holds up: the problem is real and shown, the plan fixes it within the issue' },
    concerns: { type: 'array', items: { type: 'object', properties: { severity: { enum: ['blocking', 'worth-raising', 'minor'] }, point: { type: 'string' } }, required: ['severity', 'point'] } },
    questions: { type: 'array', items: { type: 'string' }, description: 'More choices for the owner, if the brief missed any' },
  },
  required: ['sound', 'concerns', 'questions'],
}

const BUILT = {
  type: 'object',
  properties: {
    branch: { type: 'string' },
    commits: { type: 'array', items: { type: 'string' }, description: 'git log --oneline master..branch' },
    after: { type: 'array', items: { type: 'object', properties: { file: { type: 'string' }, shows: { type: 'string' } }, required: ['file', 'shows'] } },
    checks: { type: 'array', items: { type: 'object', properties: { check: { type: 'string' }, result: { type: 'string' } }, required: ['check', 'result'] }, description: 'backend npm test, frontend npm run lint and npm run build, plus any other; pass/fail with the count or error' },
    mark: { type: 'string', description: 'Where the decision was recorded' },
    pr: { type: 'string', description: 'Path of the PR description draft' },
    left: { type: 'array', items: { type: 'string' }, description: 'Anything not done, failing, or for the owner to decide' },
  },
  required: ['branch', 'commits', 'after', 'checks', 'mark', 'pr', 'left'],
}

const FINDINGS = {
  type: 'object',
  properties: {
    findings: { type: 'array', items: { type: 'object', properties: {
      severity: { enum: ['blocking', 'should-fix', 'nit'] },
      where: { type: 'string' },
      what: { type: 'string' },
      fix: { type: 'string' },
    }, required: ['severity', 'where', 'what', 'fix'] } },
  },
  required: ['findings'],
}

if (stage === 'scope') {
  phase('Scope')
  const brief = await agent(`Scope GitHub issue #${n} for the owner, without fixing anything yet.
${RULES}
1. Read the issue with its comments (gh issue view ${n} --comments) and the tracker #51 (its decisions and order). Read the code it names and whatever else the problem touches.
2. Create the branch issue-${n}${part ? '-' + part : ''}-<short-slug> from master (git switch -c).${part ? ` This is a second PR for the issue, the part "${part}": an earlier part is merged already (see the issue's linked PRs); scope only this part.` : ''} Leave uncommitted files as they are.
3. Reproduce the problem on the dev stack, and record the Before evidence in ${dir}/: write ${dir}/before.mjs (a tools/evidence scenario, so the same one can be played after the fix), set the scene with dev.sh, play it with record.sh. Screenshots for what is seen, an mp4 for anything that moves or sounds, a failing test or request for what is not on screen. If something can't be shown, say why.
4. Plan the fix within the issue's scope. Name the blast radius honestly: other screens, the owl's tours (text changes mean re-recording with tools/help-voice/run.sh), sounds (check-sound), gender-neutral kids' text (check-gender), shared/types + schemas + store migrations, the stars economy, and any manual step piserve's live data would need.
5. Write the brief to ${dir}/brief.json (the same object you return), so the build stage starts from it.
${notes ? `\nThe owner's notes for this scope:\n${notes}\n` : ''}
Return the brief.`, { label: `scope #${n}`, phase: 'Scope', schema: BRIEF, effort: 'high' })
  if (!brief) throw new Error('the scope agent returned nothing')

  phase('Challenge')
  const critique = await agent(`Challenge this brief for GitHub issue #${n} before the owner sees it. Try to find what is wrong with it; don't polish it.
${RULES}
Do not change code or the branch. The brief:
${JSON.stringify(brief, null, 1)}

Check, against the issue (gh issue view ${n} --comments), the tracker #51 and the code:
- Is the problem real and does the Before evidence show it? Open the evidence files it cites (Read the .png; for an .mp4, read the scenario .mjs and the .sound.json to see what it played). Evidence that doesn't show the problem is blocking.
- Is the cause right (check the file:line)?
- Does the plan fix the problem the kids or the owner see, within the issue, without breaking what the code is for? Is there a simpler fix?
- What's missing from the blast radius?
- Which choices are really the owner's and missing from the questions?
Return your critique.`, { label: `challenge #${n}`, phase: 'Challenge', schema: CRITIQUE, effort: 'high' })

  return { stage, issue: n, dir, brief, critique, next: `Show the owner the brief and the critique, with the evidence, and wait. Then run {issue: ${n}, stage: "build", notes: "<their reactions, verbatim>"}.` }
}

// build: from the brief and the owner's reactions, or a revision of what's on the branch
phase('Build')
const build = prompt => agent(prompt, { label: `build #${n}`, phase: 'Build', schema: BUILT, effort: 'high' })
const built = await build(`Build the fix for GitHub issue #${n}.
${RULES}
Start from ${dir}/brief.json (the scope agreed with the owner) and the owner's notes below; the notes win where they differ. Switch to the branch it names. If the branch already has commits and ${dir}/PR.md exists, this is a revision: apply the notes to what is there, and re-record only the evidence they affect.

1. Fix it, in logical commits. Where the problem can be a test, write the test first and see it fail.
2. If an owl bubble's text changed, re-record its voice (tools/help-voice/run.sh) and commit what it lists.
3. Record the After evidence: play the same scenario as before (${dir}/before.mjs, copied to ${dir}/after.mjs if it needs adjusting for the new screen) into ${dir}/; the same screens at the same sizes, so they compare.
4. Checks, in the dev containers: backend npm test; frontend npm run lint and npm run build. Report each with its result. Lint has pre-existing eslint problems on master; compare the count with master instead of fixing unrelated ones.
5. Leave a mark: record the decision where the next agent looks (CLAUDE.md or the tool's README), in its own commit.
6. Draft the PR description in ${dir}/PR.md, following .github/pull_request_template.md: "Closes #${n}"; Before, Problem, Fix, After, Blast radius, Checks (ticked as they really went). Reference evidence by bare file name (e.g. ![before](before-calc.png), [video](before-calc.mp4)); the main session publishes the files and rewrites the links. Short: each section readable in a minute. End with the line the session uses for PR descriptions (🤖 Generated with [Claude Code](https://claude.com/claude-code)).
${notes ? `\nThe owner's notes:\n${notes}\n` : '\nThe owner had no notes beyond the brief.\n'}
Return what you built.`)
if (!built) throw new Error('the build agent returned nothing')

phase('Review')
const review = () => agent(`Review the work for GitHub issue #${n} as the owner's adversary: find what is wrong before the owner does. Don't change anything.
${RULES}
- The diff: git diff master...${built.branch}. Correctness, scope creep beyond the issue, what else it breaks (CLAUDE.md lists the cross-cutting rules: types + schemas + migrations, owl anchors and tours, sounds, gender-neutral kids' text, piserve compatibility).
- The evidence in ${dir}/: open the Before and After screenshots (Read the .png) and check they show what ${dir}/PR.md says they show, at the sizes it says.
- ${dir}/PR.md against .github/pull_request_template.md: every section there, claims that match the diff and the evidence, checks ticked only if they ran. Re-run backend npm test if the diff touches the backend.
- ${dir}/brief.json and the owner's notes: is everything agreed done?
${notes ? `The owner's notes:\n${notes}\n` : ''}
Return your findings; an empty list if there is nothing.`, { label: `review #${n}`, phase: 'Review', schema: FINDINGS, effort: 'high' })

let findings = (await review())?.findings ?? []
let fixed = null
const serious = findings.filter(f => f.severity !== 'nit')
if (serious.length) {
  log(`${serious.length} findings to fix (${findings.length - serious.length} nits left for the owner)`)
  fixed = await build(`Revise the fix for GitHub issue #${n} on branch ${built.branch}: a reviewer found these. Fix the blocking and should-fix ones (new commits; re-record any evidence and re-run any check they affect; update ${dir}/PR.md). If you disagree with one, leave it and say why in "left".
${RULES}
${JSON.stringify(serious, null, 1)}
Return what you built, as a whole (all commits, all evidence, all checks).`)
}

return {
  stage, issue: n, dir,
  built: fixed ?? built,
  review: findings,
  fixedAfterReview: !!fixed,
  next: `Show the owner ${dir}/PR.md with the evidence and the review, and wait. More notes: run {issue: ${n}, stage: "build", notes}. "Ship it": the main session publishes the evidence (tools/evidence/publish.sh ${n}), pushes the branch, opens the PR from PR.md, and comments the blast radius on #${n}.`,
}
