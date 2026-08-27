import asyncio
import sys
from datetime import UTC, datetime
from types import SimpleNamespace

from alerter import (
    AlerterConfig,
    AlertState,
    CheckResult,
    check_backup_freshness,
    check_disk_usage,
    check_offsite,
    check_readiness,
    check_replica_and_slot,
    process_checks,
)


def test_fresh_backup_is_healthy(tmp_path):
    marker = tmp_path / "backup-freshness"
    marker.write_text("2026-08-26T03:15:00+00:00\n", encoding="ascii")

    result = check_backup_freshness(
        marker,
        max_age_hours=25,
        now=datetime(2026, 8, 26, 12, 0, tzinfo=UTC),
    )

    assert result.state == "ok"


def test_old_or_missing_backup_is_critical(tmp_path):
    marker = tmp_path / "backup-freshness"
    marker.write_text("2026-08-24T00:00:00+00:00\n", encoding="ascii")
    now = datetime(2026, 8, 26, 12, 0, tzinfo=UTC)

    old = check_backup_freshness(marker, max_age_hours=25, now=now)
    missing = check_backup_freshness(tmp_path / "missing", max_age_hours=25, now=now)

    assert old.state == "critical"
    assert missing.state == "critical"


def test_offsite_marker_maps_warn_and_fail_without_exposing_detail(tmp_path):
    marker = tmp_path / "offsite-status"
    marker.write_text(
        "warn 2026-08-26T03:15:00+00:00 remote-not-configured\n",
        encoding="ascii",
    )

    warning = check_offsite(marker)
    marker.write_text(
        "fail 2026-08-26T03:15:00+00:00 copy-failed\n",
        encoding="ascii",
    )
    failure = check_offsite(marker)

    assert warning.state == "warning"
    assert failure.state == "critical"
    assert "copy-failed" not in failure.detail


def test_disk_thresholds_are_checked_without_host_access(tmp_path):
    def fake_usage(path):
        assert path == str(tmp_path)
        return SimpleNamespace(total=100, used=91, free=9)

    result = check_disk_usage([tmp_path], usage=fake_usage)

    assert result.state == "critical"


def test_readiness_probe_uses_injected_transport():
    class Response:
        status = 200

        def close(self):
            pass

    def fake_open(request, timeout):
        assert request.full_url == "http://backend:8000/api/v1/ready"
        assert timeout == 2
        return Response()

    result = check_readiness(
        "http://backend:8000/api/v1/ready",
        timeout_seconds=2,
        opener=fake_open,
    )

    assert result.state == "ok"


def test_active_incident_is_deduplicated_and_has_one_recovery():
    broken = [CheckResult("readiness", "critical", "http_status=503")]
    healthy = [CheckResult("readiness", "ok", "http_status=200")]
    sent = []

    state, event = process_checks(
        broken,
        AlertState(),
        True,
        lambda message: sent.append(message) or True,
    )
    assert event == "alert"
    assert len(sent) == 1

    state, event = process_checks(broken, state, True, lambda message: sent.append(message) or True)
    assert event is None
    assert len(sent) == 1

    state, event = process_checks(
        healthy,
        state,
        True,
        lambda message: sent.append(message) or True,
    )
    assert event == "recovery"
    assert len(sent) == 2
    assert state == AlertState()


def test_missing_telegram_configuration_is_a_safe_noop():
    broken = [CheckResult("readiness", "critical", "http_status=503")]
    sent = []

    state, event = process_checks(
        broken,
        AlertState(),
        telegram_configured=False,
        send=lambda message: sent.append(message) or True,
    )

    assert event == "alert"
    assert sent == []
    assert state == AlertState(active=True, notification_sent=False)


def test_telegram_sender_does_not_open_network_without_credentials():
    def fail_if_called(*args, **kwargs):
        raise AssertionError("network must not be used")

    from alerter import send_telegram

    assert not send_telegram("", "", "message", opener=fail_if_called)


def test_replica_probe_uses_columns_available_in_postgres(monkeypatch, tmp_path):
    class Connection:
        def __init__(self, replica=False):
            self.replica = replica

        async def fetchrow(self, query, *args):
            if self.replica:
                raise AssertionError("replica connection must not query primary views")
            if "pg_replication_slots" in query:
                return {"active": True, "wal_status": "reserved", "retained_bytes": 128}
            if "pg_stat_replication" in query:
                # В pg_stat_replication нет столбца slot_name.
                if "slot_name" in query:
                    raise RuntimeError("column slot_name does not exist")
                return {"state": "streaming", "lag_bytes": 256}
            raise AssertionError("unexpected query")

        async def fetchval(self, query):
            assert query == "SELECT pg_is_in_recovery()"
            return True

        async def close(self):
            pass

    connections = iter((Connection(), Connection(replica=True)))

    async def connect(**kwargs):
        return next(connections)

    monkeypatch.setitem(sys.modules, "asyncpg", SimpleNamespace(connect=connect))
    config = AlerterConfig(
        readiness_url="http://backend/ready",
        primary_host="db",
        primary_port=5432,
        replica_host="db-replica",
        replica_port=5432,
        database="technozrelost",
        database_user="technoz",
        database_password="",
        replication_slot="tz_replica_slot",
        freshness_marker=tmp_path / "freshness",
        max_backup_age_hours=25,
        offsite_marker=tmp_path / "offsite",
        disk_paths=(tmp_path,),
        disk_warn_percent=80,
        disk_critical_percent=90,
        slot_lag_warn_bytes=1024,
        slot_lag_critical_bytes=2048,
        replica_lag_critical_bytes=4096,
        state_file=tmp_path / "state.json",
        interval_seconds=60,
        probe_timeout_seconds=1,
        telegram_bot_token="",
        telegram_chat_id="",
    )

    results = asyncio.run(check_replica_and_slot(config))

    assert [(result.name, result.state) for result in results] == [
        ("replica", "ok"),
        ("replication_slot", "ok"),
        ("replica_lag", "ok"),
    ]
