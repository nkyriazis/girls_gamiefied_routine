Blast radius of the fix (one cron reading for schedules and chores, `backend/src/cron.ts`):

**Beyond the plan**
- Schedules changed too, not only chores. They now match the tick's whole minute: master fired only when the tick landed in the first 999 ms. And on spring-forward night (last Sunday of March) a schedule at exactly 04:00 now fires; master skipped it, so it fired 364 times a year instead of 365. On fall-back night a 03:xx schedule still fires twice, as before.
- A chore cron cron-parser can't read logs `CHORE_CRON_ERROR` once per chore and cron. The other chores carry on.

**Chores on piserve that start firing or change days**
- Start firing (they never did): a day list that mixes a range and single days (what the form writes for Δευ Τρί Τετ Παρ: `1-3,5`), a step with a start (`0-30/10`), Sunday written as 7, and day of month with day of week (now either one; before, only when both held). More chores the kids can claim, so more stars.
- Change days: a step on day of month or month now counts from 1. `0 9 */7 * *` moves from the 7th, 14th, 21st, 28th to the 1st, 8th, 15th, 22nd, 29th. `*/2` on day of month moves from even days to odd days. `0 9 1 */2 *` moves from February, April… to January, March… A range ending in 7 (`5-7`) gains Sunday.
- Unchanged: `*`, single values, a single range up to 6, a plain list, `*/n` on minute, hour or day of week. Schedules were already read by cron-parser, so none of these shifts touch them.

**Manual step for piserve (the owner runs it; read-only, before deploying)**
No migration and no data change. To see which of the family's chores and schedules fire differently over the next year, on the image deployed today:
```
ssh piserve 'cd ~/work/girls_gamiefied_routine && docker-compose -f docker-compose.yml -f docker-compose.release.yml exec -T backend node -' < .evidence/22/compare-live.js
```
Any chore listed as DIFFERENT starts firing or moves days after the deploy. Any listed as INVALID never fired and still won't. Fix or remove those in the parent form.

**Follow-ups (drafted, not opened yet)**
- Reject a cron that cron-parser can't read, in the config and in the parent form, then throttle `SCHEDULE_ERROR` the same way. Also, for the record: `BACKUP_CRON` follows the container's `TZ`, and `simpleCronToTime` only handles `M H`. Draft in `.evidence/22/followup.md`.

No other open issue's premise changes. The #51 decision stands: missed minutes stay missed.
