export function matchWorkout(planned, activities) {
  const sameDaySameSport = activities.filter(
    (activity) => activity.sportType === planned.sportType && activity.startDate.slice(0, 10) === planned.date
  );

  if (!sameDaySameSport.length) return null;

  return sameDaySameSport.sort((a, b) => {
    const target = planned.plannedDurationMin || 0;
    const aDiff = Math.abs(a.movingTimeSeconds / 60 - target);
    const bDiff = Math.abs(b.movingTimeSeconds / 60 - target);
    return aDiff - bDiff;
  })[0];
}
