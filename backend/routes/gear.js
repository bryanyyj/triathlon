import { Router } from "express";
import { getAllGear } from "../lib/gearStore.js";
import { getActivitiesByGearId, getGearUsageStats } from "../lib/activityStore.js";

export const gearRouter = Router();

// Serves cached gear from the DB (populated during Strava sync). Sorted so
// active gear leads, primary first, then by lifetime distance.
gearRouter.get("/api/strava/gear", (req, res) => {
  try {
    const usageByGear = new Map(getGearUsageStats().map((row) => [String(row.gearId), row]));

    const gear = getAllGear()
      .map((item) => {
        const usage = usageByGear.get(String(item.id));
        return {
          ...item,
          activityCount: usage ? Number(usage.activityCount) : 0,
          lastUsed: usage?.lastUsed || null,
        };
      })
      .sort((a, b) => {
        if (a.retired !== b.retired) return a.retired ? 1 : -1;
        if (a.primary !== b.primary) return a.primary ? -1 : 1;
        return b.distanceMeters - a.distanceMeters;
      });

    res.json({ gear });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

gearRouter.get("/api/strava/gear/:id/analytics", (req, res) => {
  try {
    const activities = getActivitiesByGearId(req.params.id);

    if (!activities.length) {
      return res.json({
        totalSessions: 0,
        avgDistanceKm: 0,
        avgDurationMin: 0,
        avgSpeedKmh: null,
        avgPaceMinKm: null,
        avgHeartRate: null,
        avgCadence: null,
        avgPower: null,
        totalElevationM: 0,
        monthlyBreakdown: [],
        recentSessions: [],
      });
    }

    const totalSessions = activities.length;
    const totalDistanceM = activities.reduce((s, a) => s + (a.distanceMeters || 0), 0);
    const totalDurationSec = activities.reduce((s, a) => s + (a.movingTimeSeconds || 0), 0);
    const totalElevationM = activities.reduce((s, a) => s + (a.elevationGainMeters || 0), 0);

    const hrArr = activities.filter((a) => a.averageHeartRate);
    const avgHeartRate = hrArr.length
      ? Math.round(hrArr.reduce((s, a) => s + a.averageHeartRate, 0) / hrArr.length)
      : null;

    const cadArr = activities.filter((a) => a.averageCadence);
    const avgCadence = cadArr.length
      ? Math.round(cadArr.reduce((s, a) => s + a.averageCadence, 0) / cadArr.length)
      : null;

    const pwrArr = activities.filter((a) => a.averagePower);
    const avgPower = pwrArr.length
      ? Math.round(pwrArr.reduce((s, a) => s + a.averagePower, 0) / pwrArr.length)
      : null;

    const avgDistanceKm = Math.round((totalDistanceM / 1000 / totalSessions) * 10) / 10;
    const avgDurationMin = Math.round(totalDurationSec / 60 / totalSessions);
    const avgSpeedKmh =
      totalDurationSec > 0 ? Math.round(((totalDistanceM / 1000) / (totalDurationSec / 3600)) * 10) / 10 : null;
    const avgPaceMinKm =
      totalDistanceM > 0 ? Math.round(((totalDurationSec / 60) / (totalDistanceM / 1000)) * 10) / 10 : null;

    const monthlyMap = {};
    for (const a of activities) {
      const month = a.startDate.substring(0, 7);
      if (!monthlyMap[month]) monthlyMap[month] = { month, sessions: 0, distanceKm: 0, durationMin: 0 };
      monthlyMap[month].sessions += 1;
      monthlyMap[month].distanceKm += (a.distanceMeters || 0) / 1000;
      monthlyMap[month].durationMin += (a.movingTimeSeconds || 0) / 60;
    }
    const monthlyBreakdown = Object.values(monthlyMap)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((m) => ({ ...m, distanceKm: Math.round(m.distanceKm * 10) / 10, durationMin: Math.round(m.durationMin) }));

    const recentSessions = activities
      .slice(-20)
      .reverse()
      .map((a) => ({
        date: a.startDate,
        distanceKm: Math.round(((a.distanceMeters || 0) / 1000) * 10) / 10,
        durationMin: Math.round((a.movingTimeSeconds || 0) / 60),
        avgHr: a.averageHeartRate,
        avgSpeed:
          a.movingTimeSeconds > 0
            ? Math.round(((a.distanceMeters / 1000) / (a.movingTimeSeconds / 3600)) * 10) / 10
            : null,
      }));

    res.json({
      totalSessions,
      avgDistanceKm,
      avgDurationMin,
      avgSpeedKmh,
      avgPaceMinKm,
      avgHeartRate,
      avgCadence,
      avgPower,
      totalElevationM: Math.round(totalElevationM),
      monthlyBreakdown,
      recentSessions,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
