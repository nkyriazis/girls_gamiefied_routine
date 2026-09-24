// The cron shapes the forms edit: "M H * * DAYS", i.e. a time on some weekdays.
// Anything else is shown and edited as the raw expression.

export interface Weekly {
    time: string; // HH:mm
    days: number[]; // 0 = Sunday … 6 = Saturday; all seven = every day
}

export const DAY_LABELS = ['Κυρ', 'Δευ', 'Τρί', 'Τετ', 'Πέμ', 'Παρ', 'Σάβ'];
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

function parseDays(field: string): number[] | null {
    if (field === '*') return ALL_DAYS;
    const days = new Set<number>();
    for (const part of field.split(',')) {
        const m = /^(\d)(?:-(\d))?$/.exec(part);
        if (!m) return null;
        const from = Number(m[1]), to = Number(m[2] ?? m[1]);
        if (to < from || to > 7) return null;
        for (let d = from; d <= to; d++) days.add(d % 7);
    }
    return [...days].sort((a, b) => a - b);
}

export function parseWeekly(cron: string): Weekly | null {
    const f = cron.trim().split(/\s+/);
    if (f.length !== 5 || f[2] !== '*' || f[3] !== '*' || !/^\d+$/.test(f[0]) || !/^\d+$/.test(f[1])) return null;
    const [minute, hour] = [Number(f[0]), Number(f[1])];
    const days = parseDays(f[4]);
    if (!days || minute > 59 || hour > 23) return null;
    return { time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`, days };
}

function daysField(days: number[]): string {
    if (days.length === 7) return '*';
    const sorted = [...days].sort((a, b) => a - b);
    // Runs of consecutive days as ranges: [1,2,3,4,5] -> "1-5"
    const parts: string[] = [];
    for (let i = 0; i < sorted.length; i++) {
        let j = i;
        while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
        parts.push(j - i >= 2 ? `${sorted[i]}-${sorted[j]}` : sorted.slice(i, j + 1).join(','));
        i = j;
    }
    return parts.join(',');
}

export function formatWeekly({ time, days }: Weekly): string {
    const [hour, minute] = time.split(':').map(Number);
    return `${minute} ${hour} * * ${daysField(days)}`;
}

export function describeCron(cron: string): string {
    const weekly = parseWeekly(cron);
    if (!weekly) return cron;
    const { time, days } = weekly;
    if (days.length === 7) return `${time} κάθε μέρα`;
    if (daysField(days) === '1-5') return `${time} Δευ–Παρ`;
    if (daysField(days) === '0,6') return `${time} Σαβ–Κυρ`;
    return `${time} ${WEEK_ORDER.filter(d => days.includes(d)).map(d => DAY_LABELS[d]).join(' ')}`;
}
