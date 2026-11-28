export const meta = {
  name: 'lesson',
  description: 'Make a lesson package in one run, chapter to video (source, checks, pictures, a second reader, a referee, the owl\'s voice, the video); the owner reacts once, to the video and the words to hear. Then apply (their words) or make again with their notes.',
  whenToUse: 'The owner asks for a lesson from a chapter, or reacts to one. args: {stage: "make", chapter: "<which chapter, in words>" | book: {pdf, from, to, firstPrinted}, id?} for a new one; {stage: "make", id, notes: "<the owner\'s reactions, verbatim>"} to change one; {stage: "signoff", ids: [..]}; {stage: "apply", ids: [..], verdicts?: "<file>"}; {stage: "review", id, read?: true}. Each stage ends with what to show the owner; publishing the sign-off page, reading its answers, sending the video and anything in git are the main session\'s, on the owner\'s word. See .claude/skills/lesson-package/SKILL.md.',
  phases: [
    { title: 'Find', detail: 'the chapter\'s pages in the mirrored books' },
    { title: 'Write', detail: 'lesson.src.json from the pages, or the owner\'s notes applied to it' },
    { title: 'Build', detail: 'the scripts check it; a fixer gets each refusal, up to 3 times' },
    { title: 'Look', detail: 'the cut pictures looked at, and a second reader against the book; one round of fixes' },
    { title: 'Learn', detail: 'the owner\'s notes written down as pending corrections' },
    { title: 'Referee', detail: 'what was left for the owner, settled from the teacher\'s book, the pages and the pictures; only the rest goes up' },
    { title: 'Voice', detail: 'record and listen, as many lessons at once as the GPU has room for; the page of words the owner has not heard' },
    { title: 'Apply', detail: 'the owner\'s answers into the speech rules; record again what changed' },
    { title: 'Video', detail: 'the lesson played through, for the owner to watch' },
  ],
}

const stage = args?.stage
const STAGES = ['make', 'signoff', 'apply', 'review']
if (!STAGES.includes(stage)) throw new Error(`args.stage is one of ${STAGES.join(', ')}`)
const okId = s => typeof s === 'string' && /^[a-z]+(-[a-z0-9]+)+$/.test(s)
const notes = (args?.notes ?? '').trim()
const ids = (args?.ids ?? (args?.id ? [args.id] : [])).map(String)
for (const i of ids) if (!okId(i)) throw new Error(`"${i}" is no lesson id (istoria-e-14)`)

const B = '.claude/skills/lesson-package/briefs'
const W = 'tools/lessons/work'
const FIXES = 3 // refusals of the build a fixer may answer before the stage stops and reports

// What every agent here holds to, beyond CLAUDE.md and its own brief
const RULES = `
Rules for this run:
- You are one step of the lesson workflow. Your brief is the one file named above; don't load the lesson-package skill, the other briefs or the Workflow tool.
- ${W}/ holds the book's text and pictures and is git-ignored. Never copy any of it into a tracked file, and never use git add, commit or push.
- Never change a check (tools/lessons/test), a script (tools/lessons), a brief, the speech rules' statuses, or a lesson other than the one named. A guard compares them after you. If one of them seems wrong, say so in your answer: that is the owner's to change.
- Tooling runs in Docker through the scripts as they are. Nothing on the GPU unless your task says so: never tools/lessons/build.sh without --no-voice, never voice.sh or voices.sh.
- Say what you did and saw, not that it is right.`

// --- What the agents answer ---

const RAN = {
  type: 'object',
  properties: {
    exit: { type: 'integer', description: 'The command\'s exit code' },
    output: { type: 'string', description: 'Its output, copied exactly as printed (no summary, no translation), cut as the task says' },
  },
  required: ['exit', 'output'],
}
const FOUND = {
  type: 'object',
  properties: {
    startedAt: { type: 'integer', description: 'What `date +%s` printed when you started' },
    id: { type: 'string', description: '<subject>-<grade letter>-<chapter>, lowercase ascii' },
    pdf: { type: 'string', description: 'The student book\'s file under materials/pdf' },
    from: { type: 'integer', description: 'First PDF page of the chapter' },
    to: { type: 'integer', description: 'Last PDF page, before the next chapter\'s title' },
    firstPrinted: { type: 'integer', description: 'The number printed on the first page' },
    title: { type: 'string' },
    goals: { type: 'string', description: 'The chapter\'s goals from the teacher\'s book, a few lines; empty if none found' },
    doubts: { type: 'array', items: { type: 'string' }, description: 'Anything unsure about which chapter or pages' },
  },
  required: ['startedAt', 'id', 'pdf', 'from', 'to', 'firstPrinted', 'title', 'goals', 'doubts'],
}
const WROTE = {
  type: 'object',
  properties: {
    pieces: { type: 'integer' },
    questions: { type: 'integer' },
    leftOut: { type: 'array', items: { type: 'string' }, description: 'What of the chapter is not in the lesson, and why' },
    unplaced: { type: 'array', items: { type: 'string' }, description: 'What on the pages could not be placed (a caption printed inside a sentence…)' },
    forOwner: { type: 'array', items: { type: 'string' }, description: 'Choices that are the owner\'s, each with what you did meanwhile' },
  },
  required: ['pieces', 'questions', 'leftOut', 'unplaced', 'forOwner'],
}
const FIXED = {
  type: 'object',
  properties: {
    changed: { type: 'array', items: { type: 'string' }, description: 'Each change to lesson.src.json, one line' },
    cannot: { type: 'array', items: { type: 'string' }, description: 'What you left, and why (a check this chapter can\'t meet, the PDF\'s layout, something for the owner)' },
  },
  required: ['changed', 'cannot'],
}
const PICTURES = {
  type: 'object',
  properties: {
    pictures: { type: 'array', items: { type: 'object', properties: {
      file: { type: 'string' },
      ok: { type: 'boolean' },
      saw: { type: 'string', description: 'What the picture shows, one line' },
      wrong: { type: 'string', description: 'What is wrong; empty when ok' },
      fix: { type: 'string', description: 'The box or regions that would be right; empty when ok' },
    }, required: ['file', 'ok', 'saw', 'wrong', 'fix'] } },
  },
  required: ['pictures'],
}
const FINDINGS = {
  type: 'object',
  properties: {
    findings: { type: 'array', items: { type: 'object', properties: {
      severity: { enum: ['blocking', 'should-fix', 'nit'] },
      where: { type: 'string', description: 'The piece or the step number' },
      what: { type: 'string' },
      fix: { type: 'string' },
    }, required: ['severity', 'where', 'what', 'fix'] } },
  },
  required: ['findings'],
}
const LEARNED = {
  type: 'object',
  properties: {
    rows: { type: 'array', items: { type: 'object', properties: {
      note: { type: 'string', description: 'The owner\'s correction, in a line, without the book\'s text' },
      home: { type: 'string', description: 'Where a rule for it would live: a check (which), a brief (which file), or "this lesson only"' },
    }, required: ['note', 'home'] } },
  },
  required: ['rows'],
}
const REFEREED = {
  type: 'object',
  properties: {
    settled: { type: 'array', items: { type: 'object', properties: {
      question: { type: 'string' }, answer: { type: 'string' },
      source: { type: 'string', description: 'What settles it: the teacher\'s book goal, the page, what you saw in the picture, the brief\'s line' },
      change: { type: 'string', description: 'The change it calls for in the source, or "none"' },
    }, required: ['question', 'answer', 'source', 'change'] } },
    forOwner: { type: 'array', items: { type: 'object', properties: {
      question: { type: 'string' }, choices: { type: 'string', description: 'What each answer would mean, in a line' },
      why: { type: 'string', description: 'Why no source settles it' },
    }, required: ['question', 'choices', 'why'] } },
  },
  required: ['settled', 'forOwner'],
}
const RULED = {
  type: 'object',
  properties: {
    added: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, match: { type: 'string' }, say: { type: 'string' }, why: { type: 'string' } }, required: ['id', 'match', 'say', 'why'] } },
    why: { type: 'string', description: 'Why these, or why none was a pattern' },
  },
  required: ['added', 'why'],
}

// --- A script, run by an agent that does nothing else ---

// The workflow has no shell of its own. `long`: minutes on the GPU or the screen, past a foreground command's limit.
const run = (label, command, phaseName, { long = false, keep = 'all of it when under 100 lines, else the last 100 lines' } = {}) => agent(
  `Run one command from the repository root and report it. Do nothing else: whatever it prints or however it ends, don't fix, edit, retry or run anything more.

${long ? `It can take an hour or more. Start it in the background (Bash with run_in_background: true), exactly as:

{ ${command} ; } > ${W}/.run-${stage}.log 2>&1; echo "exit $?" >> ${W}/.run-${stage}.log

Wait for the notification that it has ended (don't poll, don't sleep). Then read ${W}/.run-${stage}.log: the exit code is on its last line.` : `Exactly:

${command}`}

Return the exit code, and the output (stdout and stderr together) copied exactly: ${keep}.`,
  { label, phase: phaseName, schema: RAN, effort: 'low' })
const must = (r, what) => { if (!r) throw new Error(`${what}: the agent returned nothing`); return r }
const lines = (r, re) => (r?.output ?? '').split('\n').filter(l => re.test(l))

// ============================================================ make

let goOn = null // a new or revised lesson goes on, through the voice, to the video: the owner reacts once, there
if (stage === 'make') {
  let id = ids[0]
  let found = null
  const fresh = !notes
  if (fresh && !args?.book && !args?.chapter) throw new Error('make needs book {pdf, from, to, firstPrinted} or chapter (in words) for a new lesson, or id + notes to change one')
  if (!fresh && !id) throw new Error('make with notes needs the id of the lesson they are about')

  if (fresh && !args?.book) {
    phase('Find')
    found = must(await agent(`Find this chapter in the mirrored school books: ${args.chapter}

Your brief: ${B}/find.md (read it first). Before anything else run \`date +%s\` and return what it prints as startedAt.${id ? `\nThe id is already chosen: ${id}.` : ''}
${RULES}`, { label: 'find the chapter', phase: 'Find', schema: FOUND, effort: 'medium' }), 'find')
    id = id ?? found.id
    if (!okId(id)) throw new Error(`the id found, "${id}", is no lesson id`)
    if (found.doubts.length) log(`Find is unsure: ${found.doubts.join('; ')}`)
  }
  const book = args?.book ?? found
  if (fresh && !id) throw new Error('make with a book needs the id (istoria-e-14)')
  const dir = `${W}/${id}`

  // The clock, the pages to read, and the guard's memory of everything an agent must not change
  const setup = must(await run(`set up ${id}`,
    `tools/lessons/stage.sh start make ${id}${found ? ' ' + found.startedAt : ''} && ` +
    (fresh ? `tools/lessons/pages.sh ${book.pdf} ${book.from} ${book.to} ${dir} && ` : '') +
    `tools/lessons/guard.sh snap ${id}`, fresh ? 'Find' : 'Write'), 'setup')
  if (setup.exit !== 0) return { stage, id, status: 'stuck', at: 'setup', output: setup.output, next: 'Show the owner why the pages could not be rendered.' }

  phase('Write')
  const wrote = must(await agent(fresh
    ? `Write the lesson ${id} from its chapter.

Your brief: ${B}/source.md (read it first; it is all of it).
The pages are in ${dir}/ (page-N.png and page-N.txt), PDF pages ${book.from}-${book.to} of ${book.pdf}; the number printed on the first is ${book.firstPrinted}.${found?.title ? ` The chapter: «${found.title}».` : ''}${found?.goals ? `\nThe teacher's book gives these goals:\n${found.goals}` : ''}
Write ${dir}/lesson.src.json, and check yourself with tools/lessons/build.sh ${id} --no-voice until it stops refusing or you can't fix what it refuses.
${RULES}`
    : `Change the lesson ${id} as the owner asks.

Your brief: ${B}/source.md (read it first): the owner's notes win where they differ from it; everything they don't touch stays as it is, and still follows the brief.
The source is ${dir}/lesson.src.json; the pages are beside it (page-N.png). ${dir}/lesson.md is the text the owner read: their step and piece numbers are its.
Check yourself with tools/lessons/build.sh ${id} --no-voice.

The owner's notes, verbatim:
${notes}
${RULES}`, { label: `${fresh ? 'write' : 'revise'} ${id}`, phase: 'Write', schema: WROTE, effort: 'high' }), 'write')

  // The scripts decide whether it builds; a fixer gets only what they refused
  let fixes = 0
  const cannot = []
  const buildUntilGreen = async (round) => {
    for (let k = 0; ; k++) {
      const built = must(await run(`build ${id}${round}${k ? ` (${k + 1})` : ''}`, `tools/lessons/build.sh ${id} --no-voice`, 'Build'), 'build')
      if (built.exit === 0) return built
      if (k === FIXES) return built
      fixes++
      const fixed = must(await agent(`The build refused the lesson ${id}. Fix its source.

Your brief: ${B}/fix.md (read it first).
The source: ${dir}/lesson.src.json; the pages beside it (page-N.png). After your changes run tools/lessons/build.sh ${id} --no-voice yourself to see.

What the build printed:
${built.output}
${RULES}`, { label: `fix ${id}${round} (${k + 1})`, phase: 'Build', schema: FIXED, effort: 'high' }), 'fix')
      cannot.push(...fixed.cannot)
      if (!fixed.changed.length) return built // nothing it can do: don't spend the other tries on the same refusal
    }
  }
  phase('Build')
  let built = await buildUntilGreen('')
  const stuck = (at, output) => ({ stage, id, status: 'stuck', at, output, cannot, fixes, wrote,
    next: `The build still refuses ${id} after ${fixes} fixes. Show the owner what it refuses and what the fixer could not do; their answer goes in {stage: "make", id: "${id}", notes}. Don't loosen a check to get past it.` })
  if (built.exit !== 0) { await run(`log ${id}`, `tools/lessons/stage.sh end make ${id} '{"fixes":${fixes},"stuck":1}'`, 'Build'); return stuck('build', built.output) }

  // Two readers who did not write it, at once: one looks at what was cut, one reads it against the book
  phase('Look')
  const drawn = must(await run(`draw ${id}`, `tools/lessons/show.sh ${id} && tools/lessons/regions.sh ${id}`, 'Look'), 'show')
  const flagged = lines(built, /^(LOOK|PEND| {6}→)/).join('\n')
  const look = () => agent(`Look at the pictures cut for the lesson ${id}.

Your brief: ${B}/pictures.md (read it first).
The lesson's folder: ${dir}/ (package/images/, regions/, lesson.src.json, page-N.png).
${RULES}`, { label: `pictures ${id}`, phase: 'Look', schema: PICTURES, effort: 'medium' })
  const [seen, read] = await parallel([look, () => agent(`Read the lesson ${id} as its second reader.

Your brief: ${B}/critique.md (read it first).
The lesson as text: ${dir}/lesson.md; the pages: ${dir}/page-N.png; the source, if you need a field: ${dir}/lesson.src.json.
${flagged ? `The build's lines for a person to judge:\n${flagged}` : 'The build left no LOOK or PEND line.'}
${RULES}`, { label: `second reader ${id}`, phase: 'Look', schema: FINDINGS, effort: 'high' })])
  if (!seen) log('Nobody looked at the pictures (the agent returned nothing): the owner must')
  if (!read) log('No second reader (the agent returned nothing): the owner reads it unchecked')
  const badPictures = (seen?.pictures ?? []).filter(p => !p.ok)
  const findings = read?.findings ?? []
  const serious = findings.filter(f => f.severity !== 'nit')
  let leftPictures = badPictures
  let afterFix = null
  if (badPictures.length || serious.length) {
    log(`${badPictures.length} pictures and ${serious.length} findings to fix (${findings.length - serious.length} nits left for the owner)`)
    fixes++
    afterFix = must(await agent(`Two readers found these in the lesson ${id}. Fix its source.

Your briefs: ${B}/source.md (what a lesson is) and ${B}/fix.md (what a fix must keep); read both first.
The source: ${dir}/lesson.src.json; the pages beside it. Where you disagree with a finding, leave it and say why in "cannot". Then run tools/lessons/build.sh ${id} --no-voice to see.

The pictures:
${JSON.stringify(badPictures, null, 1)}

The second reader (blocking and should-fix):
${JSON.stringify(serious, null, 1)}
${RULES}`, { label: `fix findings ${id}`, phase: 'Look', schema: FIXED, effort: 'high' }), 'fix findings')
    cannot.push(...afterFix.cannot)
    built = await buildUntilGreen(' again')
    if (built.exit !== 0) { await run(`log ${id}`, `tools/lessons/stage.sh end make ${id} '{"fixes":${fixes},"stuck":1}'`, 'Look'); return stuck('build after the readers\' findings', built.output) }
    if (badPictures.length) {
      await run(`draw ${id} again`, `tools/lessons/regions.sh ${id}`, 'Look')
      leftPictures = ((await look())?.pictures ?? badPictures).filter(p => !p.ok)
      if (leftPictures.length) log(`${leftPictures.length} pictures still wrong after one fix: for the owner`)
    }
  }

  // The owner's notes, kept: each one a pending correction that only the owner turns into a rule
  let learned = null
  if (!fresh) {
    phase('Learn')
    learned = await agent(`The owner corrected the lesson ${id}. Write each correction down, so the next lesson can avoid it.

Read .claude/skills/lesson-package/corrections.md (its top says how a row is written) and add one row per correction to the end of its table, status "pending". Change nothing else, in that file or any other: no brief, no check. A row never quotes the book; it names the kind of mistake. For "home", say where a rule for it would live: a check a machine could make (which), a line of a brief (which file), or "this lesson only" when it teaches nothing general.

The owner's notes, verbatim:
${notes}
${RULES}`, { label: `learn from ${id}`, phase: 'Learn', schema: LEARNED, effort: 'medium' })
  }

  // The owner can't switch context for every choice: a referee settles what a source settles, and only the rest
  // goes up. With nothing left for the owner, the stage goes on to the voice by itself.
  const questions = [
    ...(found?.doubts ?? []).map(q => `Finding the chapter: ${q}`),
    ...(wrote.forOwner ?? []).map(q => `The writer: ${q}`),
    ...findings.filter(f => f.severity === 'nit').map(f => `A nit of the second reader (${f.where}): ${f.what} Suggested: ${f.fix}`),
    ...cannot.map(q => `A finding the fixer did not apply: ${q}`),
    ...leftPictures.map(p => `A picture still wrong (${p.file}): ${p.wrong}`),
  ]
  let refereed = { settled: [], forOwner: [] }
  if (questions.length) {
    phase('Referee')
    refereed = (await agent(`Settle what was left for the owner in the lesson ${id}.

Your brief: ${B}/referee.md (read it first).
The lesson's folder: ${dir}/ (lesson.md, lesson.src.json, page-N.png and .txt, package/images/, regions/).${found?.goals ? `\nThe teacher's book gives these goals:\n${found.goals}` : ''}

The questions:
${questions.map((q, k) => `${k + 1}. ${q}`).join('\n')}
${RULES}`, { label: `referee ${id}`, phase: 'Referee', schema: REFEREED, effort: 'high' })) ?? { settled: [], forOwner: questions.map(q => ({ question: q, choices: '', why: 'the referee returned nothing' })) }
    const changes = refereed.settled.filter(x => x.change && x.change.trim().toLowerCase() !== 'none')
    if (changes.length) {
      fixes++
      const fixedR = must(await agent(`A referee settled these questions about the lesson ${id} from the books. Make the changes they call for in its source.

Your briefs: ${B}/source.md and ${B}/fix.md; read both first.
The source: ${dir}/lesson.src.json; the pages beside it. Then run tools/lessons/build.sh ${id} --no-voice to see.

${JSON.stringify(changes, null, 1)}
${RULES}`, { label: `apply rulings ${id}`, phase: 'Referee', schema: FIXED, effort: 'high' }), 'apply rulings')
      cannot.push(...fixedR.cannot)
      built = await buildUntilGreen(' after the rulings')
      if (built.exit !== 0) { await run(`log ${id}`, `tools/lessons/stage.sh end make ${id} '{"fixes":${fixes},"stuck":1}'`, 'Referee'); return stuck('build after the referee\'s rulings', built.output) }
    }
  }

  const closing = must(await run(`close ${id}`,
    `tools/lessons/show.sh ${id}; tools/lessons/guard.sh check ${id}; g=$?; ` +
    `tools/lessons/stage.sh end make ${id} '{"fixes":${fixes},"findings":${findings.length},"pictures":${badPictures.length},"settled":${refereed.settled.length},"forOwner":${refereed.forOwner.length},"revision":${fresh ? 0 : 1}}'; exit $g`,
    fresh ? 'Look' : 'Learn'), 'close')
  const guarded = closing.exit === 0
  const made = {
    stage, id, status: guarded ? 'ready' : 'guard',
    read: `${dir}/lesson.md`,
    found, wrote, fixes,
    build: lines(built, /^(LOOK|PEND|FAIL| {6}→|\d+\/\d+ pass|pending )/),
    pictures: { looked: seen?.pictures?.length ?? 0, stillWrong: leftPictures },
    secondReader: { findings, fixed: afterFix?.changed ?? [], notFixed: cannot },
    referee: refereed,
    learned: learned?.rows ?? [],
    guard: closing.output,
    drawn: drawn.output,
    next: guarded
      ? `Show the owner ${dir}/lesson.md (the pieces and every question with its answer), with what was left out, the nits, the pictures still wrong and the choices that are theirs; nothing here proves the history right, their reading does. Wait. Notes: {stage: "make", id: "${id}", notes: "<verbatim>"}. Happy with the text: {stage: "signoff", ids: ["${id}"]} (records the voice: minutes on the GPU).`
      : `The guard found files changed that no agent of this stage may change (see guard). Show the owner; don't go on to signoff until they say which change stays.`,
  }
  // The owner reacts once, to the video: nothing stops here but a guard. What the referee left goes with the video.
  if (!guarded) return made
  goOn = { id, made }
}

// ============================================================ signoff / apply: the owl's words

const sids = goOn ? [goOn.id] : ids
const key = sids.length === 1 ? sids[0] : '-'
// Record (only what is new), listen, and ask the gate, for several lessons: tools/lessons/voices.sh runs as many at
// once as the GPU has free memory for (it is shared), and tries a job again that ran out of GPU memory. Each lesson
// ends signed (the zip is made), waits (for the owner's ear), failed (its text, not the voice) or nogpu.
const voices = async (list, phaseName) => {
  if (!list.length) return []
  const r = must(await run(`voice ${list.join(' ')}`, `tools/lessons/voices.sh ${list.join(' ')}`, phaseName,
    { long: true, keep: 'all of it (it is one line per lesson, plus the end of a failed one\'s log)' }), 'voices')
  return list.map(id => {
    const mine = lines(r, new RegExp(`^(signed|waits|failed|nogpu)\\s+${id}(\\s|$)`))
    const state = mine.length ? mine.at(-1).split(/\s+/)[0] : 'failed'
    return { id, state, listen: lines(r, new RegExp(`^listen ${id}: `)), output: state === 'failed' || state === 'nogpu' ? r.output : undefined }
  })
}
const trouble = results => results.some(r => r.state === 'nogpu')
  ? 'The GPU had no room for some lessons (nogpu): another project holds it. Nothing is wrong with them; run the stage again for those ids when it is free.'
  : results.some(r => r.state === 'failed') ? 'A build failed before the owl\'s words (see its output): that is the text, not the voice. Show the owner; {stage: "make", id, notes} fixes the text.' : ''
const page = async (phaseName) => must(await run('the sign-off page', 'tools/lessons/signoff.sh page', phaseName), 'page')
const PUBLISH = `Publish ${W}/.signoff/review.html with the Artifact tool to the sign-off page's link (capabilities {db: {}}; the first time, a new private page), send the owner the link and wait. Never answer a card yourself. Then save the page's "verdicts" collection (ArtifactData, action list) as ${W}/.signoff/verdicts.json and run {stage: "apply", ids: ${JSON.stringify(sids)}}.`

if (stage === 'signoff' || goOn) {
  if (!sids.length) throw new Error('signoff needs ids (or id)')
  phase('Voice')
  must(await run('start', `tools/lessons/stage.sh start signoff ${key}`, 'Voice'), 'start')
  const results = await voices(sids, 'Voice')
  const waits = results.filter(r => r.state === 'waits').map(r => r.id)
  const made = waits.length ? await page('Voice') : null
  await run('log', `tools/lessons/stage.sh end signoff ${key} '{"lessons":${sids.length},"waits":${waits.length},"failed":${results.filter(r => r.state === 'failed').length},"nogpu":${results.filter(r => r.state === 'nogpu').length}}'`, 'Voice')
  if (goOn) {
    if (trouble(results)) return { stage: 'make', id: goOn.id, make: goOn.made, results, next: trouble(results) }
    goOn.voice = { results, waits, page: made?.output }
  } else return {
    stage, ids: sids, results, page: made?.output,
    next: trouble(results) ? trouble(results) + (waits.length ? ` For the others: ${PUBLISH}` : '')
      : waits.length ? PUBLISH
      : `Every word is signed off and the zips are made. {stage: "review", id} makes the video for the owner's eye.`,
  }
}

if (stage === 'apply') {
  if (!ids.length) throw new Error('apply needs the ids the answers are for')
  const verdicts = args?.verdicts ?? `${W}/.signoff/verdicts.json`
  phase('Apply')
  // The answers go in by script; the guard then remembers the rules as the owner left them
  const applied = must(await run('apply the answers',
    `tools/lessons/stage.sh start apply ${key} && tools/lessons/signoff.sh apply ${verdicts} ${ids.join(' ')} && tools/lessons/guard.sh snap -`, 'Apply'), 'apply')
  if (applied.exit !== 0) return { stage, ids, status: 'stuck', output: applied.output, next: 'The answers could not be applied (see output). Nothing was signed off by hand; show the owner.' }
  const respelled = lines(applied, /new rule word-/)
  let ruled = null
  let guard = null
  if (respelled.length) {
    ruled = await agent(`The owner respelled ${respelled.length} of the owl's words. Decide whether any is a pattern.

Your brief: ${B}/speech.md (read it first).
What the apply printed:
${applied.output}
${RULES}`, { label: 'a word or a pattern', phase: 'Apply', schema: RULED, effort: 'medium' })
    guard = must(await run('guard the rules', 'tools/lessons/guard.sh check - --rules-may-grow', 'Apply'), 'guard')
    if (guard.exit !== 0) return { stage, ids, status: 'guard', ruled, guard: guard.output,
      next: 'The speech rules or other protected files changed in a way only the owner may (see guard). Show the owner before recording anything.' }
  }
  const signed = lines(applied, /^signed\s/).map(l => l.split(/\s+/)[1])
  const results = signed.map(id => ({ id, state: 'signed', listen: [] }))
  results.push(...await voices(lines(applied, /^waits\s/).map(l => l.split(/\s+/)[1]), 'Apply'))
  const waits = results.filter(r => r.state === 'waits').map(r => r.id)
  const made = waits.length ? await page('Apply') : null
  const rounds = await run('log', `tools/lessons/stage.sh end apply ${key} '{"respelled":${respelled.length},"patterns":${ruled?.added?.length ?? 0},"waits":${waits.length}}'; ` +
    `docker run --rm -v "$PWD":/w -w /w node:24-alpine node tools/lessons/speech/rounds.mjs`, 'Apply')
  return {
    stage, ids, applied: lines(applied, /^(rule |«|signed|waits|no answers)/), patterns: ruled, results, page: made?.output, rounds: rounds?.output,
    next: trouble(results) ? trouble(results) + (waits.length ? ` For the others: ${PUBLISH}` : '')
      : waits.length ? `Words still wait (a respelling is heard once more). ${PUBLISH}`
      : `Every word is signed off and the zips are made. Show the owner the rounds (each should be shorter than the last). The changes to tools/lessons/speech/rules.json go in a commit when the owner says. {stage: "review", id} makes the video.`,
  }
}

// ============================================================ review: the video

if (!goOn && ids.length !== 1) throw new Error('review needs one id')
const id = goOn ? goOn.id : ids[0]
phase('Video')
const video = must(await run(`video ${id}`,
  `tools/lessons/stage.sh start review ${id}; tools/lessons/video.sh ${id}${args?.read ? ' --read' : ''}; s=$?; tools/lessons/stage.sh end review ${id}; exit $s`,
  'Video', { long: true, keep: 'the last 20 lines' }), 'video')
const asks = goOn?.made?.referee?.forOwner ?? []
if (goOn) return {
  stage: 'make', id, status: video.exit === 0 ? 'ready' : 'stuck', make: goOn.made, voice: goOn.voice, output: video.output,
  video: video.exit === 0 ? `${W}/${id}.mp4` : undefined,
  next: (video.exit === 0
    ? `Send the owner, together and once: ${W}/${id}.mp4 (the file itself: it holds the book's text)` +
      (goOn.voice.waits.length ? `, the sign-off page (${PUBLISH.replace(/^Publish /, 'publish ')})` : '') +
      (asks.length ? `, and only these questions, each answerable in a word: ${asks.map(q => `${q.question} (${q.choices})`).join('; ')}` : '') +
      `. Wait. Their notes on the lesson go in {stage: "make", id: "${id}", notes} (which ends with a new video); their words in apply. The zip for the Pi is made when every word is signed off.`
    : 'The video was not made (see output: the dev stack down, or a schedule about to start). Tell the owner what it needs, with the sign-off page if words wait; don\'t drive the screen by hand instead.'),
}
return {
  stage, id, status: video.exit === 0 ? 'ready' : 'stuck', output: video.output,
  video: video.exit === 0 ? `${W}/${id}.mp4` : undefined,
  next: video.exit === 0
    ? `Send the owner ${W}/${id}.mp4 (the file itself: it holds the book's text, so nowhere public) and wait. Notes: {stage: "make", id: "${id}", notes}, then signoff and review again for what changed. Happy: the owner imports ${W}/${id}.zip at /parent → Ρυθμίσεις → Μαθήματα → Εισαγωγή.`
    : 'The video was not made (see output: the dev stack down, or a schedule about to start). Tell the owner what it needs; don\'t drive the screen by hand instead.',
}
