import { useState } from "react";
import type { Race } from "../types";
import { daysUntil, getRaceIcon } from "../lib/raceCalculations";
import { AddRaceModal } from "./AddRaceModal";

type UpcomingRacesProps = {
  races: Race[];
  onAddRace: (race: Partial<Race>) => Promise<void>;
};

export function UpcomingRaces({ races, onAddRace }: UpcomingRacesProps) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <section className="rounded-3xl bg-tri-card p-6 border border-white/10">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Upcoming Races</h2>
          <p className="text-sm text-white/50">Train with your next goal in mind.</p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="rounded-xl bg-gradient-to-r from-tri-purple to-tri-pink px-4 py-2 text-sm font-semibold text-white"
        >
          + Add Race
        </button>
      </div>

      {races.length === 0 ? (
        <p className="text-white/50 text-sm">No upcoming races yet. Add your first goal race.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {races.map((race) => (
            <div key={race.id} className="rounded-2xl bg-tri-soft p-5 border border-white/10 shadow-lg relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-tri-purple via-tri-pink to-tri-orange" />

              <div className="flex items-start justify-between">
                <div>
                  <p className="text-2xl">{getRaceIcon(race.raceType)}</p>
                  <h3 className="mt-3 text-lg font-bold text-white">{race.raceName}</h3>
                  <p className="text-sm text-white/50">{race.raceDistance}</p>
                </div>

                <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">
                  {race.priority || "B"} Race
                </span>
              </div>

              <div className="mt-5">
                <p className="text-5xl font-black text-white">{daysUntil(race.raceDate)}</p>
                <p className="text-sm text-white/50">days to go</p>
              </div>

              {race.targetGoal && <p className="mt-4 text-sm text-white/70">Target: {race.targetGoal}</p>}

              <div className="mt-5">
                <div className="mb-2 flex justify-between text-xs text-white/50">
                  <span>Training Progress</span>
                  <span>{race.trainingProgress ?? 0}%</span>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-tri-purple to-tri-pink"
                    style={{ width: `${race.trainingProgress ?? 0}%` }}
                  />
                </div>
              </div>

              {race.readinessScore !== undefined && (
                <div className="mt-4 rounded-xl bg-white/5 p-3">
                  <p className="text-xs uppercase tracking-widest text-white/40">Race Readiness</p>
                  <p className="text-2xl font-bold text-white">{race.readinessScore}/100</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <AddRaceModal
          onClose={() => setModalOpen(false)}
          onSubmit={async (race) => {
            await onAddRace(race);
            setModalOpen(false);
          }}
        />
      )}
    </section>
  );
}
