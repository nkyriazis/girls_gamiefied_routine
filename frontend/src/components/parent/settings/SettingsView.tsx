import { ChoresEditor } from './ChoresEditor';
import { KidsEditor } from './KidsEditor';
import { RewardsEditor } from './RewardsEditor';
import { SchedulesEditor } from './SchedulesEditor';
import { SchoolEditor } from './SchoolEditor';
import { StartNow } from './StartNow';

// The config parents change: what the store sells, when things start, which chores exist,
// the kids (name, avatar, colour, class) and the school's daily numbers.
export function SettingsView() {
    return (
        <div className="p-settings">
            <RewardsEditor />
            <SchedulesEditor />
            <StartNow />
            <ChoresEditor />
            <KidsEditor />
            <SchoolEditor />
        </div>
    );
}
