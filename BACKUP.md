# Backups

The family's data lives in `backend/` on the Pi: `routine.db` (star balances, history), `data.json` and
`exercises.json` (the config) and `uploads/` (avatars, pictures). The backend backs all of it up once a day.

**With nothing set, the backups stay on the SD card** (`./backups/daily` in the checkout), next to the data they
protect, so a dead card takes both. They only leave the card once `BACKUP_DIR` in `.env` points at a USB disk or a NAS.
Until then the backend warns, in its log and in every `BACKUP` entry of the action log, that BACKUP_DIR is on the
same filesystem as the database.

## What a backup is

Every day at 03:17 (`BACKUP_CRON`, in the container's `TZ`, Europe/Athens), and at startup when the newest backup is
more than a day old, the backend writes a folder `BACKUP_DIR/<YYYY-MM-DD_HHMMSS>` with:

| File | How |
|---|---|
| `routine.db` | `VACUUM INTO`: one consistent copy while the app keeps running, a single file (no `-wal`), checked with `PRAGMA integrity_check` |
| `data.json`, `exercises.json` | byte for byte, as they are on disk |
| `uploads/` | the whole folder |
| `SHA256SUMS` | in `sha256sum` format: `cd <folder> && sha256sum -c SHA256SUMS` verifies it |

It is written as `.partial-<stamp>` and renamed when complete, so a backup cut short never counts. The newest
`BACKUP_KEEP` (14) are kept and older ones deleted; nothing else in the folder is ever touched. The files belong to
the owner of `BACKUP_DIR`. The backup runs in a child process, so a slow or hung disk never freezes the kids' screens.
Each run adds `BACKUP` (folder, files, size, integrity, the balances in the copy) or `BACKUP_FAILED` to the action log,
which you can read in Γονείς → Προχωρημένα → Καταγραφή.

Disk use: 14 × (routine.db + uploads/), a few MB to tens of MB. An upload may be up to 10 MB (an alarm song, a
photo), and every backup holds all of them, so each song kept in Αρχεία adds up to 14 × its size: 3 songs of
5 MB are about 200 MB across the backups. Delete songs nobody rings any more. Check on the Pi with
`ls -la backend/routine.db; du -sh backend/uploads backups/daily`.

## Moving the backups off the card

1. **Mount the disk at boot.** Plug in the USB disk, find its UUID with `lsblk -f`, and add a line to `/etc/fstab`
   (`nofail`: the Pi still boots without it):

   ```
   UUID=<uuid>  /mnt/usb  ext4  defaults,nofail,x-systemd.device-timeout=10s  0  2
   ```

   For a NAS, an NFS or CIFS line with `_netdev,nofail`. Then `sudo mkdir -p /mnt/usb && sudo mount -a`.
   With `nofail`, Docker doesn't wait for the mount by itself, so tell it to:

   ```bash
   sudo mkdir -p /etc/systemd/system/docker.service.d
   printf '[Unit]\nWants=mnt-usb.mount\nAfter=mnt-usb.mount\n' | sudo tee /etc/systemd/system/docker.service.d/backup-mount.conf
   sudo systemctl daemon-reload
   ```

   A disk plugged in after the backend started is not seen inside the container. If the disk isn't mounted, the
   backups land in the empty mount point, on the card, and the same-filesystem warning says so.
2. **Make the folder, as yourself, and point `BACKUP_DIR` at it** in `.env` (next to `docker-compose.yml`). Docker
   reads the host path from there; inside the container it is always `/backups`.

   ```bash
   mkdir -p /mnt/usb/routine-backups        # sudo + chown if the disk's root is root's
   echo 'BACKUP_DIR=/mnt/usb/routine-backups' >> .env
   ```

   Optional: `BACKUP_KEEP=30`, `BACKUP_CRON=0 4 * * *`, `BACKUP_TIMEOUT=3600` (seconds).
3. **Redeploy** so the backend gets the new mount: `./deploy-rpi.sh` (or
   `docker compose -f docker-compose.yml -f docker-compose.release.yml up -d backend`).
4. **Take one now and check it:**

   ```bash
   docker compose -f docker-compose.yml -f docker-compose.release.yml exec backend npm run backup
   ls /mnt/usb/routine-backups
   cd /mnt/usb/routine-backups/<newest> && sha256sum -c SHA256SUMS
   ```

   No `WARNING: ... same filesystem` line means the backup left the card.

On a FAT/exFAT stick files have no owners (fine). On an NFS share with `root_squash` the container's root may not
be allowed to write: `BACKUP_FAILED` in the action log says so; export the share with `no_root_squash` or make the
folder writable by everyone.

A disk or share that hangs for good (an NFS share mounted `hard` whose server is gone, a USB disk stuck in the
kernel) would hold a backup forever. After `BACKUP_TIMEOUT` (7200 s, 2 h; set it in `.env`) the backend kills it and
logs `BACKUP_FAILED` with `reason: "timed out"`, and the next day's backup runs as usual. The killed run leaves its
`.partial-<stamp>` folder behind (it never counts as a backup); delete it by hand. A process stuck on a dead disk may
only die when the disk answers or the Pi restarts, and while it hangs inside the database copy SQLite can't trim
`routine.db-wal`, which grows on the card. So a `timed out` in Καταγραφή means: check the disk or share, and if it
is stuck, restart the Pi.

The first time with the default folder, create it as yourself before deploying (`mkdir -p backups/daily` in the
checkout); otherwise Docker creates it as root and the backups in it are root's.

## Restoring

```bash
./restore-backup.sh /mnt/usb/routine-backups/2026-10-05_031700
```

It verifies the backup against `SHA256SUMS` before touching anything, asks, stops the backend, moves the live
`data.json`, `exercises.json`, `routine.db`, `routine.db-wal`, `routine.db-shm` and `uploads/` into
`backups/pre-restore-<stamp>/` (nothing is deleted), copies the backup in and checks it again, starts the backend
and prints the balances. The folder set aside gets its own `SHA256SUMS`, so
`./restore-backup.sh backups/pre-restore-<stamp>` undoes the restore.

By hand, the same steps; the one that matters is to move `routine.db-wal` and `routine.db-shm` away too, or SQLite
replays the old WAL onto the restored database:

```bash
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.release.yml"
B=/mnt/usb/routine-backups/2026-10-05_031700
(cd $B && sha256sum -c SHA256SUMS)
$COMPOSE stop backend
mkdir -p backups/pre-restore && sudo mv backend/{data.json,exercises.json,routine.db,routine.db-wal,routine.db-shm,uploads} backups/pre-restore/
sudo cp -a $B/{data.json,exercises.json,routine.db,uploads} backend/
$COMPOSE start backend
```

## A config file the backend can't read

If `data.json` gets a typo (a missing comma) and the backend restarts, it runs on an empty config (no kids) and the
parents' screen says so. Saving is off until the file is fixed, so nothing can write the empty config over it.
Γονείς → Προχωρημένα → Ρυθμίσεις (JSON) then shows the file's own text: fix it there and save. The broken file is
kept beside as `data.json.invalid-<stamp>`. Or restore `data.json` from a backup.
