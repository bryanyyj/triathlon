// Planned dates are the athlete's local calendar days; activity start times are UTC.
function localDay(startDate) {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(startDate));
}

export function matchWorkout(planned, activities) {
  const sameDaySameSport = activities.filter(
    (activity) => activity.sportType === planned.sportType && localDay(activity.startDate) === planned.date
  );

  if (!sameDaySameSport.length) return null;

  return sameDaySameSport.sort((a, b) => {
    const target = planned.plannedDurationMin || 0;
    const aDiff = Math.abs(a.movingTimeSeconds / 60 - target);
    const bDiff = Math.abs(b.movingTimeSeconds / 60 - target);
    return aDiff - bDiff;
  })[0];
}
