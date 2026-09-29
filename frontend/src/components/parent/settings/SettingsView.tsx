import { ChoresEditor } from './ChoresEditor';
import { RewardsEditor } from './RewardsEditor';
import { SchedulesEditor } from './SchedulesEditor';
import { SchoolEditor } from './SchoolEditor';
import { StartNow } from './StartNow';

// The config parents change: what the store sells, when things start, which chores exist,
// and which class each kid is in.
export function SettingsView() {
    return (
        <div className="p-settings">
            <RewardsEditor />
            <SchedulesEditor />
            <StartNow />
            <ChoresEditor />
            <SchoolEditor />
        </div>
    );
}
