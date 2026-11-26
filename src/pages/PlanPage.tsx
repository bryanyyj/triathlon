import type { Activity, Gear, PlannedWorkout, Race } from "../types";
import { UpcomingRaces } from "../components/UpcomingRaces";
import { PlannedWorkouts } from "../components/PlannedWorkouts";
import { GearCard } from "../components/GearCard";
import { ScrollArea } from "../components/Layout";
import { TrainingWeek } from "./TrainingWeek";

export const PLAN_TABS = [
  { value: "races", label: "Races & workouts" },
  { value: "week", label: "Training week" },
  { value: "gear", label: "Gear" },
] as const;

export type PlanTab = (typeof PLAN_TABS)[number]["value"];

type PlanPageProps = {
  tab: PlanTab;
  races: Race[];
  workouts: PlannedWorkout[];
  activities: Activity[];
  gear: Gear[];
  onAddRace: (race: Partial<Race>) => Promise<void>;
  onEditRace: (id: string, race: Partial<Race>) => Promise<void>;
  onDeleteRace: (id: string) => Promise<void>;
  onAddWorkout: (workout: Partial<PlannedWorkout>) => Promise<void>;
};

export function PlanPage({ tab, races, workouts, activities, gear, onAddRace, onEditRace, onDeleteRace, onAddWorkout }: PlanPageProps) {
  if (tab === "week") return <ScrollArea className="lg:flex-1"><TrainingWeek /></ScrollArea>;
  if (tab === "gear") return <ScrollArea className="lg:flex-1"><GearCard gear={gear} /></ScrollArea>;

  // Two lists side by side, each scrolling on its own if it grows.
  return (
    <div className="grid gap-3 lg:min-h-0 lg:flex-1 lg:grid-cols-2 lg:[grid-template-rows:minmax(0,1fr)]">
      <ScrollArea>
        <UpcomingRaces races={races} onAddRace={onAddRace} onEditRace={onEditRace} onDeleteRace={onDeleteRace} />
      </ScrollArea>
      <ScrollArea>
        <PlannedWorkouts workouts={workouts} activities={activities} onAdd={onAddWorkout} />
      </ScrollArea>
    </div>
  );
}
