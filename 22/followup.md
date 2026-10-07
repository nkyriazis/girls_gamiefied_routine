# Reject a cron the scheduler can't read, in the config and in the parent form

Follow-up to #22 (drafted for the owner; not opened).

## What is left

Since #22, schedules and chores read cron one way (`backend/src/cron.ts`, cron-parser). But the config still accepts
a cron cron-parser rejects: `data.schema.json` checks only the characters (`^[\d\*\-,/]+ …$`), so `61 18 * * *`,
`0 25 * * *` or `5-1 * * * *` pass validation and the parent form saves them in the raw field. Then:

- a schedule with such a cron logs `SCHEDULE_ERROR` every minute (the action log isn't pruned) and never fires;
- a chore logs `CHORE_CRON_ERROR` once (per chore and cron, again after a restart) and never becomes available.

Nobody sees either unless they read the log.

## Proposal

- Validate every `schedules[].cron` and `chores[].availabilityCron` with cron-parser when the config loads
  (`config.ts`, next to the AJV check), so an unreadable cron is a `configError` like any other: the last valid config
  stays live and `/api/admin/validation-status` names the field.
- The parent form's raw cron field says it can't be read before saving (the same rule, `shared/` or an endpoint).
- Before deploying, check piserve's `data.json` (`compare-live.js` from #22 lists INVALID crons): a live one would make
  the whole config invalid at the next load, so fix it first.
- Then throttle `SCHEDULE_ERROR` like `CHORE_CRON_ERROR` (once per schedule and cron), or drop both if load-time validation makes them unreachable.

## Other cron readers, for the record (none decides when a schedule or chore fires)

- `BACKUP_CRON` runs in node-cron in the container's `TZ` (Europe/Athens in docker-compose.yml), not in
  `settings.timezone`. Today they are the same zone; if `settings.timezone` ever changes, the backup hour won't follow.
  Documented in BACKUP.md; worth a line where `settings.timezone` is set, or reading it there too.
- `simpleCronToTime` (backend/src/db.ts) turns a schedule's `M H …` into the routine's display time and gives up on
  anything else (`0-30/10 7 * * *` shows no time). Display only.
- `frontend/src/components/parent/cron.ts` parses and writes the form's `M H * * DAYS` shape; anything else is edited raw.

## Left as is in #22

- Fall-back night (last Sunday of October): a schedule at 03:00–03:59 fires twice, once in each offset (it did before
  #22 too); a chore at that hour matches twice, but its second instance appears only if the first one's window
  (`expirationHours`, 1 h or less) has closed by then. Fixing it means remembering the last firing per schedule; nothing is scheduled at that hour.
