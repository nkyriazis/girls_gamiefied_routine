import { ChoresEditor } from './ChoresEditor';
import { KidsEditor } from './KidsEditor';
import { LessonsEditor } from './LessonsEditor';
import { RewardsEditor } from './RewardsEditor';
import { RoutinesEditor } from './RoutinesEditor';
import { SchedulesEditor } from './SchedulesEditor';
import { SchoolEditor } from './SchoolEditor';
import { StartNow } from './StartNow';
import { TasksEditor } from './TasksEditor';

// The config parents change: what the store sells, when things start, which chores exist, the
// routines and their tasks, the kids (name, avatar, colour, class), the school's daily numbers and the lessons library.
// Flows stay in Προχωρημένα (JSON).
export function SettingsView() {
    return (
        <div className="p-settings">
            <RewardsEditor />
            <SchedulesEditor />
            <StartNow />
            <ChoresEditor />
            <RoutinesEditor />
            <TasksEditor />
            <KidsEditor />
            <SchoolEditor />
            <LessonsEditor />
        </div>
    );
}
