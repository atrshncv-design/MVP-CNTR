import asyncio
import sys
from datetime import UTC, datetime
from pathlib import Path
from types import SimpleNamespace

import alerter as alerter_module
import pytest
from alerter import (
    AlerterConfig,
    AlertState,
    CheckResult,
    _env_float,
    aggregate_state,
    check_backup_freshness,
    check_clamav_availability,
    check_disk_usage,
    check_minio_health,
    check_offsite,
    check_readiness,
    check_replica_and_slot,
    check_wal_offsite,
    collect_checks,
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


def test_future_backup_timestamp_is_critical(tmp_path):
    marker = tmp_path / "backup-freshness"
    marker.write_text("2026-08-27T13:00:00+00:00\n", encoding="ascii")

    result = check_backup_freshness(
        marker,
        max_age_hours=25,
        now=datetime(2026, 8, 27, 12, 0, tzinfo=UTC),
    )

    assert result.state == "critical"
    assert result.detail == "timestamp in future"


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


def test_future_offsite_timestamp_is_critical(tmp_path):
    marker = tmp_path / "offsite-status"
    marker.write_text(
        "ok 2026-08-27T13:00:00+00:00 copied\n",
        encoding="ascii",
    )

    result = check_offsite(
        marker,
        now=datetime(2026, 8, 27, 12, 0, tzinfo=UTC),
    )

    assert result.state == "critical"
    assert result.detail == "timestamp in future"


def test_wal_offsite_marker_must_be_recent(tmp_path):
    marker = tmp_path / "wal-offsite-status"
    marker.write_text("ok 2026-08-26T11:55:00+00:00 copied\n", encoding="ascii")
    now = datetime(2026, 8, 26, 12, 0, tzinfo=UTC)

    healthy = check_wal_offsite(marker, max_age_seconds=300, now=now)
    stale = check_wal_offsite(marker, max_age_seconds=299, now=now)

    assert healthy.state == "ok"
    assert stale.state == "critical"


def test_future_wal_timestamp_is_critical(tmp_path):
    marker = tmp_path / "wal-offsite-status"
    marker.write_text("ok 2026-08-27T13:00:00+00:00 copied\n", encoding="ascii")

    result = check_wal_offsite(
        marker,
        max_age_seconds=300,
        now=datetime(2026, 8, 27, 12, 0, tzinfo=UTC),
    )

    assert result.state == "critical"


def test_disk_thresholds_are_checked_without_host_access(tmp_path):
    def fake_usage(path):
        assert path == str(tmp_path)
        return SimpleNamespace(total=100, used=91, free=9)

    result = check_disk_usage([tmp_path], usage=fake_usage)

    assert result.state == "critical"


@pytest.mark.parametrize(
    ("warn", "critical"),
    [(float("nan"), 90), (80, float("inf")), (-1, 90), (80, 101), (90, 80)],
)
def test_disk_thresholds_must_be_finite_and_ordered(warn, critical, tmp_path):
    result = check_disk_usage(
        [tmp_path],
        warn_percent=warn,
        critical_percent=critical,
        usage=lambda path: SimpleNamespace(total=100, used=10, free=90),
    )

    assert result.state == "critical"
    assert result.detail == "invalid disk threshold configuration"


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


def test_minio_health_probe_uses_injected_transport():
    class Response:
        status = 200

        def close(self):
            pass

    def fake_open(request, timeout):
        assert request.full_url == "http://minio:9000/minio/health/live"
        assert timeout == 2
        return Response()

    result = check_minio_health(
        "http://minio:9000/minio/health/live",
        timeout_seconds=2,
        opener=fake_open,
    )

    assert result == CheckResult("minio_health", "ok", "http_status=200")


def test_clamav_probe_requires_pong():
    class Connection:
        def __init__(self, response):
            self.response = response
            self.sent = b""
            self.closed = False

        def sendall(self, payload):
            self.sent = payload

        def recv(self, size):
            assert size == 16
            return self.response

        def close(self):
            self.closed = True

    healthy_connection = Connection(b"PONG\n")

    def healthy_connector(address, timeout):
        assert address == ("clamav", 3310)
        assert timeout == 2
        return healthy_connection

    healthy = check_clamav_availability(
        "clamav",
        3310,
        timeout_seconds=2,
        connector=healthy_connector,
    )
    assert healthy == CheckResult("clamav_availability", "ok", "response=PONG")
    assert healthy_connection.sent == b"PING\n"
    assert healthy_connection.closed

    unavailable = check_clamav_availability(
        "clamav",
        3310,
        connector=lambda address, timeout: (_ for _ in ()).throw(OSError()),
    )
    assert unavailable.state == "critical"


def test_storage_probe_errors_reach_aggregate_state():
    class Response:
        status = 503

        def close(self):
            pass

    minio = check_minio_health("http://minio/health", opener=lambda request, timeout: Response())
    clamav = check_clamav_availability(
        "clamav",
        3310,
        connector=lambda address, timeout: (_ for _ in ()).throw(OSError()),
    )

    assert aggregate_state([minio, clamav]) == "critical"


def test_collect_checks_includes_storage_probes(monkeypatch):
    monkeypatch.setattr(
        alerter_module,
        "check_readiness",
        lambda *args: CheckResult("readiness", "ok", "http_status=200"),
    )
    monkeypatch.setattr(
        alerter_module,
        "check_minio_health",
        lambda *args: CheckResult("minio_health", "critical", "endpoint unavailable"),
    )
    monkeypatch.setattr(
        alerter_module,
        "check_clamav_availability",
        lambda *args: CheckResult("clamav_availability", "critical", "endpoint unavailable"),
    )

    async def no_replication_checks(config):
        return []

    monkeypatch.setattr(alerter_module, "check_replica_and_slot", no_replication_checks)
    results = asyncio.run(collect_checks(AlerterConfig.from_env()))

    assert [result.name for result in results[:3]] == [
        "readiness",
        "minio_health",
        "clamav_availability",
    ]
    assert aggregate_state(results) == "critical"


def test_config_reads_storage_probe_endpoints(monkeypatch):
    monkeypatch.setenv("ALERTER_MINIO_HEALTH_URL", "http://storage/health")
    monkeypatch.setenv("ALERTER_CLAMAV_HOST", "scanner")
    monkeypatch.setenv("ALERTER_CLAMAV_PORT", "3311")
    monkeypatch.setenv("BACKUP_FRESHNESS_MARKER", "/backups/custom-freshness")
    monkeypatch.setenv("WAL_OFFSITE_MARKER", "/backups/wal-status")
    monkeypatch.setenv("WAL_OFFSITE_MAX_AGE_SECONDS", "180")

    config = AlerterConfig.from_env()

    assert config.minio_health_url == "http://storage/health"
    assert config.clamav_host == "scanner"
    assert config.clamav_port == 3311
    assert config.freshness_marker == Path("/backups/custom-freshness")
    assert config.wal_offsite_marker == Path("/backups/wal-status")
    assert config.wal_offsite_max_age_seconds == 180


@pytest.mark.parametrize("raw", ["nan", "NaN", "inf", "Infinity", "-Infinity"])
def test_env_float_rejects_non_finite_values(monkeypatch, raw):
    monkeypatch.setenv("TEST_THRESHOLD", raw)

    with pytest.raises(ValueError):
        _env_float("TEST_THRESHOLD", 80.0)


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
                assert "replay_lsn" in query
                assert "flush_lsn" not in query
                return {"state": "streaming", "lag_bytes": 256, "replay_available": True}
            raise AssertionError("unexpected query")

        async def fetchval(self, query):
            if query == "SELECT pg_is_in_recovery()":
                return True
            if query == "SELECT status FROM pg_stat_wal_receiver LIMIT 1":
                return "streaming"
            raise AssertionError("unexpected replica query")

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
