import { ChoresEditor } from './ChoresEditor';
import { RewardsEditor } from './RewardsEditor';
import { SchedulesEditor } from './SchedulesEditor';
import { StartNow } from './StartNow';

// The config parents change: what the store sells, when things start, which chores exist.
export function SettingsView() {
    return (
        <div className="p-settings">
            <RewardsEditor />
            <SchedulesEditor />
            <StartNow />
            <ChoresEditor />
        </div>
    );
}
