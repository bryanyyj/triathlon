"""Pull daily sleep and health data from Garmin Connect.

Run by routes/garmin.js with the Python environment that `npm run garmin:setup`
installs (it already has the garminconnect library). Signs in only with the
tokens saved by `npm run garmin:login`; it never sees a password.

Usage: python sync.py YYYY-MM-DD [YYYY-MM-DD ...]
Prints one JSON object per line, so finished days are kept if a later one fails.
Read-only: only get_* calls are made.
"""

import json
import os
import sys
from datetime import datetime, timezone


def emit(message):
    print(json.dumps(message), flush=True)


def as_dict(value):
    return value if isinstance(value, dict) else {}


def clock(local_ms):
    """Garmin's "...TimestampLocal" values are epoch ms already shifted to local time."""
    if not local_ms:
        return None
    return datetime.fromtimestamp(local_ms / 1000, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M")


def positive(value):
    """Garmin uses negative numbers for "not measured"."""
    return value if isinstance(value, (int, float)) and value >= 0 else None


def parse_summary(raw):
    raw = as_dict(raw)
    moderate = raw.get("moderateIntensityMinutes")
    vigorous = raw.get("vigorousIntensityMinutes")
    return {
        "steps": raw.get("totalSteps"),
        "stepGoal": raw.get("dailyStepGoal"),
        "restingHr": positive(raw.get("restingHeartRate")),
        "avgStress": positive(raw.get("averageStressLevel")),
        "maxStress": positive(raw.get("maxStressLevel")),
        "bodyBatteryHigh": positive(raw.get("bodyBatteryHighestValue")),
        "bodyBatteryLow": positive(raw.get("bodyBatteryLowestValue")),
        "bodyBatteryCharged": positive(raw.get("bodyBatteryChargedValue")),
        "bodyBatteryDrained": positive(raw.get("bodyBatteryDrainedValue")),
        "totalCalories": raw.get("totalKilocalories"),
        "activeCalories": raw.get("activeKilocalories"),
        "intensityMinutes": None if moderate is None and vigorous is None else (moderate or 0) + 2 * (vigorous or 0),
    }


def parse_sleep(raw):
    raw = as_dict(raw)
    night = as_dict(raw.get("dailySleepDTO"))
    if not night.get("sleepTimeSeconds"):
        return {}
    overall = as_dict(as_dict(night.get("sleepScores")).get("overall"))
    return {
        "sleepSec": night.get("sleepTimeSeconds"),
        "deepSec": night.get("deepSleepSeconds"),
        "lightSec": night.get("lightSleepSeconds"),
        "remSec": night.get("remSleepSeconds"),
        "awakeSec": night.get("awakeSleepSeconds"),
        "sleepScore": overall.get("value"),
        "sleepStart": clock(night.get("sleepStartTimestampLocal")),
        "sleepEnd": clock(night.get("sleepEndTimestampLocal")),
        "sleepStress": positive(night.get("avgSleepStress")),
        "respiration": positive(night.get("averageRespirationValue")),
    }


def parse_hrv(raw):
    summary = as_dict(as_dict(raw).get("hrvSummary"))
    baseline = as_dict(summary.get("baseline"))
    return {
        "hrv": summary.get("lastNightAvg"),
        "hrvWeekly": summary.get("weeklyAvg"),
        "hrvBaselineLow": baseline.get("balancedLow"),
        "hrvBaselineHigh": baseline.get("balancedUpper"),
        "hrvStatus": summary.get("status"),
    }


def parse_readiness(raw):
    entry = raw[0] if isinstance(raw, list) and raw else raw
    entry = as_dict(entry)
    return {"readiness": entry.get("score"), "readinessLevel": entry.get("level")}


def main(dates):
    try:
        from garminconnect import Garmin, GarminConnectTooManyRequestsError
    except ImportError:
        emit({"error": "not_installed", "message": "Run: npm run garmin:setup"})
        return 3

    token_dir = os.path.expanduser(os.getenv("GARMINTOKENS") or "~/.garminconnect")
    if not os.path.exists(os.path.join(token_dir, "garmin_tokens.json")):
        emit({"error": "not_signed_in", "message": "Run: npm run garmin:login"})
        return 2

    try:
        client = Garmin(is_cn=os.getenv("GARMIN_IS_CN", "").lower() in ("true", "1", "yes"))
        client.login(token_dir)
    except GarminConnectTooManyRequestsError:
        emit({"error": "rate_limited", "message": "Garmin is rate limiting requests. Try again later."})
        return 4
    except Exception as error:
        emit({"error": "login_failed", "message": f"Saved Garmin sign-in failed ({type(error).__name__}). Run: npm run garmin:login"})
        return 2

    sources = (
        (client.get_user_summary, parse_summary),
        (client.get_sleep_data, parse_sleep),
        (client.get_hrv_data, parse_hrv),
        (client.get_training_readiness, parse_readiness),
    )

    for day in dates:
        record = {}
        failures = []
        for fetch, parse in sources:
            try:
                record.update({k: v for k, v in parse(fetch(day)).items() if v is not None})
            except GarminConnectTooManyRequestsError:
                emit({"error": "rate_limited", "message": "Garmin is rate limiting requests. Try again later."})
                return 4
            except Exception as error:
                failures.append(f"{fetch.__name__}: {type(error).__name__}")
        # If every request failed, don't record the day as fetched.
        if len(failures) == len(sources):
            emit({"error": "fetch_failed", "message": f"{day}: {'; '.join(failures)}"})
            return 5
        emit({"date": day, "data": record, "failures": failures})
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
