export function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS races (
      id TEXT PRIMARY KEY,
      race_name TEXT NOT NULL,
      race_type TEXT NOT NULL,
      race_distance TEXT,
      race_date TEXT NOT NULL,
      priority TEXT DEFAULT 'B',
      target_goal TEXT,
      swim_distance_km REAL,
      bike_distance_km REAL,
      run_distance_km REAL,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS race_readiness (
      id TEXT PRIMARY KEY,
      race_id TEXT NOT NULL,
      readiness_score REAL,
      training_progress REAL,
      longest_swim_km REAL,
      longest_bike_km REAL,
      longest_run_km REAL,
      weekly_consistency_score REAL,
      calculated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY,
      name TEXT,
      sport_type TEXT,
      distance_m REAL,
      moving_time_sec INTEGER,
      elapsed_time_sec INTEGER,
      elevation_gain_m REAL,
      average_hr REAL,
      max_hr REAL,
      average_power REAL,
      weighted_power REAL,
      average_cadence REAL,
      start_date TEXT,
      synced_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_activities_start_date ON activities(start_date)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_activities_sport_type ON activities(sport_type)`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS strava_auth (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      access_token TEXT,
      refresh_token TEXT,
      expires_at INTEGER,
      athlete_id TEXT,
      athlete_name TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS planned_workouts (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      sport_type TEXT NOT NULL,
      workout_type TEXT,
      planned_duration_min INTEGER,
      planned_distance_km REAL,
      target_zone TEXT,
      target_tss REAL,
      notes TEXT,
      matched_activity_id TEXT,
      status TEXT DEFAULT 'planned',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
}
