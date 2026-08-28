import ipaddress
import os
import re
import runpy
import shlex
import subprocess
import sys
import time
import uuid
from pathlib import Path

import pytest

BACKEND_ROOT = Path(__file__).resolve().parent.parent
INFRA_ROOT = BACKEND_ROOT / "infra"
REPO_ROOT = BACKEND_ROOT.parent


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write_executable(path: Path, source: str) -> None:
    path.write_text(source, encoding="utf-8")
    path.chmod(0o755)


def compose_default_subnet(source: str) -> str:
    network_block = source.split("\nnetworks:\n", 1)[1]
    match = re.search(r"(?m)^[ \t]+-[ \t]+subnet:[ \t]+([^ \t\r\n#]+)", network_block)
    assert match is not None
    return match.group(1)


def hba_records(source: str) -> list[list[str]]:
    records = []
    for line in source.splitlines():
        line = line.split("#", 1)[0].strip()
        if line:
            records.append(line.split())
    return records


def compose_service_block(source: str, service: str, next_service: str) -> str:
    return source.split(f"  {service}:", 1)[1].split(f"  {next_service}:", 1)[0]


def install_backup_stubs(fake_bin: Path) -> None:
    write_executable(
        fake_bin / "pg_dump",
        "#!/bin/sh\n"
        "while [ \"$#\" -gt 0 ]; do\n"
        "  if [ \"$1\" = \"-f\" ]; then\n"
        "    printf 'logical dump\\n' > \"$2\"\n"
        "    exit 0\n"
        "  fi\n"
        "  shift\n"
        "done\n"
        "exit 1\n",
    )
    write_executable(
        fake_bin / "pg_basebackup",
        "#!/bin/sh\n"
        "destination=\n"
        "while [ \"$#\" -gt 0 ]; do\n"
        "  if [ \"$1\" = \"-D\" ]; then destination=\"$2\"; shift 2; else shift; fi\n"
        "done\n"
        "[ -n \"$destination\" ] || exit 1\n"
        "mkdir -p \"$destination\"\n"
        "printf '16\\n' > \"$destination/PG_VERSION\"\n",
    )


def backup_environment(tmp_path: Path, fake_bin: Path) -> dict[str, str]:
    return {
        **os.environ,
        "PATH": f"{fake_bin}:{os.defpath}",
        "BACKUP_DIR": str(tmp_path / "backups"),
        "BACKUP_KEEP": "1",
        "BACKUP_STRICT_MINIO": "1",
        "BACKUP_OFFSITE_REMOTE": "",
        "RCLONE_CONFIG": "",
        "POSTGRES_HOST": "db",
        "POSTGRES_PORT": "5432",
        "POSTGRES_USER": "technoz",
        "POSTGRES_PASSWORD": "db-password",
        "POSTGRES_DB": "technozrelost",
        "REPL_USER": "replicator",
        "REPL_PASSWORD": "replica-password",
        "MINIO_URL": "http://minio:9000",
        "MINIO_ENDPOINT": "minio:9000",
        "MINIO_ACCESS_KEY": "access-key",
        "MINIO_SECRET_KEY": "secret-key",
        "MINIO_BUCKET": "technozrelost",
    }


def run_backup(tmp_path: Path, fake_bin: Path, extra: dict[str, str] | None = None):
    env = backup_environment(tmp_path, fake_bin)
    if extra:
        env.update(extra)
    return subprocess.run(
        ["/bin/sh", str(INFRA_ROOT / "backup.sh")],
        env=env,
        check=False,
        capture_output=True,
        text=True,
    )


def test_backup_snapshot_contains_physical_base_backup_before_success_marker():
    source = read_text(INFRA_ROOT / "backup.sh")

    assert "umask 077" in source
    assert 'mktemp -d "$BACKUP_DIR/${TS}.XXXXXX"' in source
    assert "pg_dump" in source
    assert "pg_basebackup" in source
    assert 'REPL_USER="${REPL_USER:-replicator}"' in source
    assert 'REPL_PASSWORD="${REPL_PASSWORD:-}"' in source
    assert '-D "$SNAPSHOT/pg_basebackup" -Fp -X stream -P -w' in source
    assert 'BACKUP_STRICT_MINIO:-1' in source
    assert source.index("basebackup_pg\n") < source.rindex("BACKUP_OK=1")
    assert "print0" in source
    assert "xargs -0" in source
    assert 'docker exec -i -e PGPASSWORD=' not in source
    assert 'PGPASSWORD="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD обязателен}" pg_dump' in source


def test_backup_fixed_timestamp_still_creates_distinct_private_snapshots(tmp_path):
    fake_bin = tmp_path / "bin"
    fake_bin.mkdir()
    install_backup_stubs(fake_bin)
    write_executable(
        fake_bin / "date",
        "#!/bin/sh\n"
        "case \"$*\" in\n"
        "  *%Y%m%dT%H%M%SZ*) printf '20260827T120000Z\\n' ;;\n"
        "  *%Y-%m-%dT%H:%M:%S%z*) printf '2026-08-27T12:00:00+0000\\n' ;;\n"
        "  *) /bin/date \"$@\" ;;\n"
        "esac\n",
    )
    write_executable(fake_bin / "mc", "#!/bin/sh\nexit 0\n")

    first = run_backup(tmp_path, fake_bin, {"BACKUP_KEEP": "10"})
    second = run_backup(tmp_path, fake_bin, {"BACKUP_KEEP": "10"})

    snapshots = sorted((tmp_path / "backups").glob("20260827T120000Z.*"))
    assert first.returncode == 0
    assert second.returncode == 0
    assert len(snapshots) == 2
    for snapshot in snapshots:
        assert snapshot.stat().st_mode & 0o777 == 0o700
        assert (snapshot / "SHA256SUMS").stat().st_mode & 0o777 == 0o600
    assert (tmp_path / "backups" / ".backup-freshness").stat().st_mode & 0o777 == 0o600


def test_backup_checksum_find_failure_does_not_publish_freshness_marker(tmp_path):
    fake_bin = tmp_path / "bin"
    fake_bin.mkdir()
    install_backup_stubs(fake_bin)
    write_executable(fake_bin / "find", "#!/bin/sh\nexit 1\n")
    write_executable(fake_bin / "mc", "#!/bin/sh\nexit 0\n")

    result = run_backup(tmp_path, fake_bin)

    assert result.returncode == 1
    assert not (tmp_path / "backups" / ".backup-freshness").exists()
    assert not list((tmp_path / "backups").glob("20*"))


def test_backup_mc_creates_or_checks_bucket_before_mirror(tmp_path):
    fake_bin = tmp_path / "bin"
    fake_bin.mkdir()
    install_backup_stubs(fake_bin)
    mc_log = tmp_path / "mc.log"
    write_executable(
        fake_bin / "mc",
        "#!/bin/sh\nprintf '%s\\n' \"$*\" >> \"$MC_LOG\"\n",
    )

    result = run_backup(tmp_path, fake_bin, {"MC_LOG": str(mc_log)})

    assert result.returncode == 0
    commands = mc_log.read_text(encoding="ascii").splitlines()
    mb = "mb --ignore-existing tzbackup/technozrelost"
    listing = "ls tzbackup/technozrelost"
    mirror = "mirror --overwrite tzbackup/technozrelost"
    assert mb in commands
    assert listing in commands
    assert any(command.startswith(mirror) for command in commands)
    assert commands.index(mb) < commands.index(listing) < next(
        index for index, command in enumerate(commands) if command.startswith(mirror)
    )


def test_backup_fails_closed_when_mc_bucket_ensure_fails(tmp_path):
    fake_bin = tmp_path / "bin"
    fake_bin.mkdir()
    install_backup_stubs(fake_bin)
    write_executable(
        fake_bin / "mc",
        "#!/bin/sh\n"
        "case \"$1 $2\" in\n"
        "  'mb --ignore-existing') exit 1 ;;\n"
        "esac\n"
        "exit 0\n",
    )

    result = run_backup(tmp_path, fake_bin)

    assert result.returncode == 1
    assert not (tmp_path / "backups" / ".backup-freshness").exists()


def test_backup_python_fallback_creates_or_checks_bucket_before_listing(tmp_path):
    fake_bin = tmp_path / "bin"
    fake_bin.mkdir()
    install_backup_stubs(fake_bin)
    write_executable(
        fake_bin / "python",
        f"#!/bin/sh\nexec {shlex.quote(sys.executable)} \"$@\"\n",
    )
    pythonpath = tmp_path / "pythonpath"
    minio_package = pythonpath / "minio"
    minio_package.mkdir(parents=True)
    minio_log = tmp_path / "minio.log"
    (minio_package / "__init__.py").write_text(
        "import os\n"
        "from pathlib import Path\n"
        "\n"
        "class Minio:\n"
        "    def __init__(self, endpoint, access_key, secret_key, secure):\n"
        "        self.created = False\n"
        "        self.log = Path(os.environ['MINIO_FAKE_LOG'])\n"
        "\n"
        "    def event(self, value):\n"
        "        with self.log.open('a', encoding='ascii') as output:\n"
        "            output.write(value + '\\n')\n"
        "\n"
        "    def bucket_exists(self, bucket):\n"
        "        self.event('bucket_exists ' + bucket)\n"
        "        return self.created\n"
        "\n"
        "    def make_bucket(self, bucket):\n"
        "        self.event('make_bucket ' + bucket)\n"
        "        self.created = True\n"
        "\n"
        "    def list_objects(self, bucket, recursive):\n"
        "        self.event('list_objects ' + bucket)\n"
        "        return []\n",
        encoding="ascii",
    )
    (minio_package / "error.py").write_text(
        "class S3Error(Exception):\n"
        "    def __init__(self, code):\n"
        "        self.code = code\n",
        encoding="ascii",
    )

    result = run_backup(
        tmp_path,
        fake_bin,
        {
            "MINIO_FAKE_LOG": str(minio_log),
            "PYTHONPATH": str(pythonpath),
        },
    )

    assert result.returncode == 0
    assert minio_log.read_text(encoding="ascii").splitlines() == [
        "bucket_exists technozrelost",
        "make_bucket technozrelost",
        "bucket_exists technozrelost",
        "list_objects technozrelost",
    ]


@pytest.mark.parametrize("no_data_encryption", ["1", "TRUE"])
def test_backup_fallback_rejects_truthy_no_data_encryption_without_config_output(
    tmp_path, no_data_encryption
):
    fake_bin = tmp_path / "bin"
    fake_bin.mkdir()
    install_backup_stubs(fake_bin)
    write_executable(fake_bin / "python", "#!/bin/sh\ncat >/dev/null\n")
    copy_called = tmp_path / "rclone-copy-called"
    write_executable(
        fake_bin / "rclone",
        "#!/bin/sh\n"
        "case \"$*\" in\n"
        "  *'config show'*)\n"
        "    printf '[remote]\\ntype = crypt\\nno_data_encryption = %s\\n' \"$FAKE_NO_DATA\"\n"
        "    printf 'password = do-not-print\\n'\n"
        "    ;;\n"
        "  *copy*) touch \"$RCLONE_COPY_CALLED\" ;;\n"
        "esac\n",
    )
    config = tmp_path / "rclone.conf"
    config.write_text("[remote]\n", encoding="ascii")

    result = run_backup(
        tmp_path,
        fake_bin,
        {
            "BACKUP_OFFSITE_REMOTE": "secure:bucket",
            "RCLONE_CONFIG": str(config),
            "RCLONE_GUARD_SCRIPT": str(tmp_path / "missing-guard"),
            "FAKE_NO_DATA": no_data_encryption,
            "RCLONE_COPY_CALLED": str(copy_called),
        },
    )

    assert result.returncode == 0
    assert not copy_called.exists()
    marker = tmp_path / "backups" / ".offsite-status"
    assert marker.read_text(encoding="ascii").split()[0] == "fail"
    assert "do-not-print" not in result.stdout + result.stderr


def test_backup_config_show_failure_cannot_become_empty_success(tmp_path):
    fake_bin = tmp_path / "bin"
    fake_bin.mkdir()
    install_backup_stubs(fake_bin)
    write_executable(fake_bin / "mc", "#!/bin/sh\nexit 0\n")
    calls = tmp_path / "rclone-calls"
    write_executable(
        fake_bin / "rclone",
        "#!/bin/sh\n"
        "case \"$*\" in\n"
        "  *'config show'*)\n"
        "    exit 1\n"
        "    ;;\n"
        "  *copy*) touch \"$RCLONE_COPY_CALLED\" ;;\n"
        "esac\n",
    )
    config = tmp_path / "rclone.conf"
    config.write_text("[remote]\n", encoding="ascii")
    copy_called = tmp_path / "copy-called"

    result = run_backup(
        tmp_path,
        fake_bin,
        {
            "BACKUP_OFFSITE_REMOTE": "secure:bucket",
            "RCLONE_CONFIG": str(config),
            "RCLONE_GUARD_SCRIPT": str(tmp_path / "missing-guard"),
            "RCLONE_CALLS": str(calls),
            "RCLONE_COPY_CALLED": str(copy_called),
        },
    )

    assert result.returncode == 0
    assert not copy_called.exists()
    assert (
        (tmp_path / "backups" / ".offsite-status").read_text(encoding="ascii").split()[0]
        == "fail"
    )


def test_configured_offsite_can_copy_only_through_crypt_remote():
    source = read_text(INFRA_ROOT / "backup.sh")

    assert "rclone_remote_is_crypt" in source
    assert "config show" in source
    assert "remote-not-crypt" in source
    assert "no_data_encryption" in source
    assert "true|1|yes|on" in source
    assert "RCLONE_GUARD_SCRIPT" in source
    assert source.index("elif ! rclone_remote_is_crypt; then") < source.index(
        'elif rclone_exec copy "$SNAPSHOT"'
    )


def test_rclone_helper_rejects_plain_and_unencrypted_remotes(tmp_path):
    helper = INFRA_ROOT / "cron" / "check-rclone-crypt.sh"
    fake_bin = tmp_path / "bin"
    fake_bin.mkdir()
    fake_rclone = fake_bin / "rclone"
    fake_rclone.write_text(
        "#!/bin/sh\n"
        "printf '[remote]\\ntype = %s\\nno_data_encryption = %s\\n' "
        '"$FAKE_TYPE" "$FAKE_NO_DATA"\n'
        "printf 'password = should-not-leak\\n'\n",
        encoding="ascii",
    )
    fake_rclone.chmod(0o755)
    config = tmp_path / "rclone.conf"
    config.write_text("[remote]\n", encoding="ascii")

    def run_helper(remote_type, no_data_encryption):
        env = os.environ.copy()
        env.update(
            {
                "PATH": f"{fake_bin}:{os.defpath}",
                "BACKUP_OFFSITE_REMOTE": "secure:bucket",
                "RCLONE_CONFIG": str(config),
                "FAKE_TYPE": remote_type,
                "FAKE_NO_DATA": no_data_encryption,
            }
        )
        return subprocess.run(
            ["/bin/sh", str(helper)],
            env=env,
            check=False,
            capture_output=True,
            text=True,
        )

    allowed = run_helper("crypt", "false")
    assert allowed.returncode == 0
    assert run_helper("s3", "false").returncode == 1
    for truthy in ("true", "TRUE", "1", "yes", "YES", "on", "On"):
        rejected = run_helper("crypt", truthy)
        assert rejected.returncode == 1
        assert "should-not-leak" not in rejected.stdout + rejected.stderr


def test_rclone_helper_propagates_config_show_failure(tmp_path):
    fake_bin = tmp_path / "bin"
    fake_bin.mkdir()
    write_executable(fake_bin / "rclone", "#!/bin/sh\nexit 1\n")
    config = tmp_path / "rclone.conf"
    config.write_text("[remote]\n", encoding="ascii")
    env = os.environ.copy()
    env.update(
        {
            "PATH": f"{fake_bin}:{os.defpath}",
            "RCLONE_CONFIG": str(config),
            "BACKUP_OFFSITE_REMOTE": "secure:bucket",
        }
    )

    result = subprocess.run(
        ["/bin/sh", str(INFRA_ROOT / "cron" / "check-rclone-crypt.sh")],
        env=env,
        check=False,
        capture_output=True,
        text=True,
    )

    assert result.returncode == 1


def test_wal_offsite_run_once_writes_success_marker(tmp_path):
    fake_bin = tmp_path / "bin"
    fake_bin.mkdir()
    fake_rclone = fake_bin / "rclone"
    fake_rclone.write_text("#!/bin/sh\nexit 0\n", encoding="ascii")
    fake_rclone.chmod(0o755)
    guard = tmp_path / "crypt-guard"
    guard.write_text("#!/bin/sh\nexit 0\n", encoding="ascii")
    guard.chmod(0o755)
    archive = tmp_path / "wal"
    archive.mkdir()
    (archive / "000000010000000000000001").write_bytes(b"wal")
    marker = tmp_path / "backup" / "wal-status"
    config = tmp_path / "rclone.conf"
    config.write_text("[remote]\n", encoding="ascii")
    env = os.environ.copy()
    env.update(
        {
            "PATH": f"{fake_bin}:{os.defpath}",
            "WAL_ARCHIVE_DIR": str(archive),
            "BACKUP_DIR": str(marker.parent),
            "WAL_OFFSITE_MARKER": str(marker),
            "WAL_OFFSITE_RUN_ONCE": "1",
            "BACKUP_OFFSITE_REMOTE": "secure:bucket",
            "RCLONE_CONFIG": str(config),
            "CHECK_RCLONE_SCRIPT": str(guard),
        }
    )

    result = subprocess.run(
        ["/bin/sh", str(INFRA_ROOT / "cron" / "wal-offsite-sync.sh")],
        env=env,
        check=False,
        capture_output=True,
        text=True,
    )

    assert result.returncode == 0
    assert marker.read_text(encoding="ascii").split(maxsplit=1)[0] == "ok"


def test_wal_offsite_without_remote_prunes_only_complete_old_segments(tmp_path):
    fake_bin = tmp_path / "bin"
    fake_bin.mkdir()
    called = tmp_path / "rclone-called"
    write_executable(fake_bin / "rclone", "#!/bin/sh\ntouch \"$RCLONE_CALLED\"\nexit 0\n")
    archive = tmp_path / "wal"
    archive.mkdir()
    old_segment = archive / "000000010000000000000001"
    old_history = archive / "00000002.history"
    fresh_segment = archive / "000000010000000000000002"
    temporary = archive / ".000000010000000000000003.tmp"
    partial = archive / ".partial"
    hidden_directory = archive / ".interrupted"
    old_segment.write_bytes(b"old")
    old_history.write_bytes(b"history")
    fresh_segment.write_bytes(b"fresh")
    temporary.write_bytes(b"temporary")
    partial.write_bytes(b"partial")
    hidden_directory.mkdir()
    hidden_segment = hidden_directory / "000000010000000000000004"
    hidden_segment.write_bytes(b"hidden")
    old_time = time.time() - 2 * 24 * 60 * 60
    os.utime(old_segment, (old_time, old_time))
    os.utime(old_history, (old_time, old_time))
    os.utime(temporary, (old_time, old_time))
    os.utime(partial, (old_time, old_time))
    os.utime(hidden_segment, (old_time, old_time))
    marker = tmp_path / "backup" / "wal-status"
    env = os.environ.copy()
    env.update(
        {
            "PATH": f"{fake_bin}:{os.defpath}",
            "RCLONE_CALLED": str(called),
            "WAL_ARCHIVE_DIR": str(archive),
            "BACKUP_DIR": str(marker.parent),
            "WAL_OFFSITE_MARKER": str(marker),
            "WAL_OFFSITE_RUN_ONCE": "1",
            "BACKUP_OFFSITE_REMOTE": "",
            "WAL_ARCHIVE_KEEP_DAYS": "1",
        }
    )

    result = subprocess.run(
        ["/bin/sh", str(INFRA_ROOT / "cron" / "wal-offsite-sync.sh")],
        env=env,
        check=False,
        capture_output=True,
        text=True,
    )

    assert result.returncode == 0
    assert not old_segment.exists()
    assert not old_history.exists()
    assert fresh_segment.exists()
    assert temporary.exists()
    assert partial.exists()
    assert hidden_segment.exists()
    assert not called.exists()
    assert marker.read_text(encoding="ascii").split()[0:3:2] == ["warn", "target-not-configured"]


def test_wal_offsite_copies_only_complete_wal_and_history_files(tmp_path):
    fake_bin = tmp_path / "bin"
    fake_bin.mkdir()
    copied_files = tmp_path / "copied-files"
    write_executable(
        fake_bin / "rclone",
        "#!/bin/sh\n"
        "while [ \"$#\" -gt 0 ]; do\n"
        "  if [ \"$1\" = \"--files-from\" ]; then cat \"$2\" > \"$RCLONE_FILES\"; exit 0; fi\n"
        "  shift\n"
        "done\n"
        "exit 1\n",
    )
    guard = tmp_path / "crypt-guard"
    write_executable(guard, "#!/bin/sh\nexit 0\n")
    archive = tmp_path / "wal"
    archive.mkdir()
    (archive / "000000010000000000000001").write_bytes(b"wal")
    (archive / "00000002.history").write_bytes(b"history")
    (archive / "0000000G.history").write_bytes(b"invalid")
    (archive / ".00000003.history.tmp").write_bytes(b"temporary")
    (archive / "000000010000000000000002.partial").write_bytes(b"partial")
    hidden_directory = archive / ".interrupted"
    hidden_directory.mkdir()
    (hidden_directory / "000000010000000000000003").write_bytes(b"hidden")
    marker = tmp_path / "backup" / "wal-status"
    config = tmp_path / "rclone.conf"
    config.write_text("[remote]\n", encoding="ascii")
    env = os.environ.copy()
    env.update(
        {
            "PATH": f"{fake_bin}:{os.defpath}",
            "RCLONE_FILES": str(copied_files),
            "WAL_ARCHIVE_DIR": str(archive),
            "BACKUP_DIR": str(marker.parent),
            "WAL_OFFSITE_MARKER": str(marker),
            "WAL_OFFSITE_RUN_ONCE": "1",
            "BACKUP_OFFSITE_REMOTE": "secure:bucket",
            "RCLONE_CONFIG": str(config),
            "CHECK_RCLONE_SCRIPT": str(guard),
        }
    )

    result = subprocess.run(
        ["/bin/sh", str(INFRA_ROOT / "cron" / "wal-offsite-sync.sh")],
        env=env,
        check=False,
        capture_output=True,
        text=True,
    )

    assert result.returncode == 0
    assert set(copied_files.read_text(encoding="ascii").splitlines()) == {
        "000000010000000000000001",
        "00000002.history",
    }
    assert marker.read_text(encoding="ascii").split()[0] == "ok"


@pytest.mark.parametrize("source_name", [None, ".segment.tmp"])
def test_wal_offsite_does_not_mark_empty_source_as_ok(tmp_path, source_name):
    fake_bin = tmp_path / "bin"
    fake_bin.mkdir()
    called = tmp_path / "rclone-called"
    write_executable(
        fake_bin / "rclone",
        "#!/bin/sh\ntouch \"$RCLONE_CALLED\"\nexit 0\n",
    )
    guard = tmp_path / "crypt-guard"
    write_executable(guard, "#!/bin/sh\nexit 0\n")
    archive = tmp_path / "wal"
    archive.mkdir()
    if source_name is not None:
        (archive / source_name).write_bytes(b"temporary")
    marker = tmp_path / "backup" / "wal-status"
    config = tmp_path / "rclone.conf"
    config.write_text("[remote]\n", encoding="ascii")
    env = os.environ.copy()
    env.update(
        {
            "PATH": f"{fake_bin}:{os.defpath}",
            "RCLONE_CALLED": str(called),
            "WAL_ARCHIVE_DIR": str(archive),
            "BACKUP_DIR": str(marker.parent),
            "WAL_OFFSITE_MARKER": str(marker),
            "WAL_OFFSITE_RUN_ONCE": "1",
            "BACKUP_OFFSITE_REMOTE": "secure:bucket",
            "RCLONE_CONFIG": str(config),
            "CHECK_RCLONE_SCRIPT": str(guard),
            "WAL_ARCHIVE_KEEP_DAYS": "7",
        }
    )

    result = subprocess.run(
        ["/bin/sh", str(INFRA_ROOT / "cron" / "wal-offsite-sync.sh")],
        env=env,
        check=False,
        capture_output=True,
        text=True,
    )

    assert result.returncode == 0
    assert marker.read_text(encoding="ascii").split()[0] == "warn"
    assert marker.read_text(encoding="ascii").split()[2] == "no-wal"
    assert not called.exists()


def test_wal_offsite_prunes_only_old_segments_after_successful_copy(tmp_path):
    fake_bin = tmp_path / "bin"
    fake_bin.mkdir()
    called = tmp_path / "rclone-called"
    write_executable(
        fake_bin / "rclone",
        "#!/bin/sh\ntouch \"$RCLONE_CALLED\"\nexit 0\n",
    )
    guard = tmp_path / "crypt-guard"
    write_executable(guard, "#!/bin/sh\nexit 0\n")
    archive = tmp_path / "wal"
    archive.mkdir()
    old_segment = archive / "000000010000000000000001"
    fresh_segment = archive / "000000010000000000000002"
    temporary = archive / ".000000010000000000000003.tmp"
    old_segment.write_bytes(b"old")
    fresh_segment.write_bytes(b"fresh")
    temporary.write_bytes(b"temporary")
    old_time = time.time() - 2 * 24 * 60 * 60
    os.utime(old_segment, (old_time, old_time))
    marker = tmp_path / "backup" / "wal-status"
    config = tmp_path / "rclone.conf"
    config.write_text("[remote]\n", encoding="ascii")
    env = os.environ.copy()
    env.update(
        {
            "PATH": f"{fake_bin}:{os.defpath}",
            "RCLONE_CALLED": str(called),
            "WAL_ARCHIVE_DIR": str(archive),
            "BACKUP_DIR": str(marker.parent),
            "WAL_OFFSITE_MARKER": str(marker),
            "WAL_OFFSITE_RUN_ONCE": "1",
            "BACKUP_OFFSITE_REMOTE": "secure:bucket",
            "RCLONE_CONFIG": str(config),
            "CHECK_RCLONE_SCRIPT": str(guard),
            "WAL_ARCHIVE_KEEP_DAYS": "1",
        }
    )

    result = subprocess.run(
        ["/bin/sh", str(INFRA_ROOT / "cron" / "wal-offsite-sync.sh")],
        env=env,
        check=False,
        capture_output=True,
        text=True,
    )

    assert result.returncode == 0
    assert called.exists()
    assert not old_segment.exists()
    assert fresh_segment.exists()
    assert temporary.exists()
    assert marker.read_text(encoding="ascii").split()[0] == "ok"


def test_wal_offsite_keeps_segments_when_copy_fails(tmp_path):
    fake_bin = tmp_path / "bin"
    fake_bin.mkdir()
    write_executable(fake_bin / "rclone", "#!/bin/sh\nexit 1\n")
    guard = tmp_path / "crypt-guard"
    write_executable(guard, "#!/bin/sh\nexit 0\n")
    archive = tmp_path / "wal"
    archive.mkdir()
    old_segment = archive / "000000010000000000000001"
    old_segment.write_bytes(b"old")
    old_time = time.time() - 2 * 24 * 60 * 60
    os.utime(old_segment, (old_time, old_time))
    marker = tmp_path / "backup" / "wal-status"
    config = tmp_path / "rclone.conf"
    config.write_text("[remote]\n", encoding="ascii")
    env = os.environ.copy()
    env.update(
        {
            "PATH": f"{fake_bin}:{os.defpath}",
            "WAL_ARCHIVE_DIR": str(archive),
            "BACKUP_DIR": str(marker.parent),
            "WAL_OFFSITE_MARKER": str(marker),
            "WAL_OFFSITE_RUN_ONCE": "1",
            "BACKUP_OFFSITE_REMOTE": "secure:bucket",
            "RCLONE_CONFIG": str(config),
            "CHECK_RCLONE_SCRIPT": str(guard),
            "WAL_ARCHIVE_KEEP_DAYS": "1",
        }
    )

    result = subprocess.run(
        ["/bin/sh", str(INFRA_ROOT / "cron" / "wal-offsite-sync.sh")],
        env=env,
        check=False,
        capture_output=True,
        text=True,
    )

    assert result.returncode == 1
    assert old_segment.exists()
    assert marker.read_text(encoding="ascii").split()[0] == "fail"


@pytest.mark.parametrize("keep_days", ["0", "-1", "", "1.5", "bad"])
def test_wal_offsite_requires_positive_integer_retention(tmp_path, keep_days):
    env = os.environ.copy()
    env.update(
        {
            "PATH": os.defpath,
            "WAL_ARCHIVE_KEEP_DAYS": keep_days,
            "WAL_OFFSITE_RUN_ONCE": "1",
        }
    )

    result = subprocess.run(
        ["/bin/sh", str(INFRA_ROOT / "cron" / "wal-offsite-sync.sh")],
        env=env,
        check=False,
        capture_output=True,
        text=True,
    )

    assert result.returncode == 2


def test_production_compose_wires_replication_and_storage_probes():
    compose = read_text(INFRA_ROOT / "docker-compose.prod.yml")
    wal_sync = read_text(INFRA_ROOT / "cron" / "wal-offsite-sync.sh")
    api_internal = "API_URL_INTERNAL: ${API_URL_INTERNAL:-http://backend:8000}"

    assert compose.count(api_internal) == 2
    assert "REPL_USER: ${REPL_USER:-replicator}" in compose
    assert compose.count("REPL_PASSWORD: ${REPL_PASSWORD:?REPL_PASSWORD обязателен}") == 4
    assert compose.count('BACKUP_STRICT_MINIO: "1"') == 2
    assert "wal-offsite:" in compose
    assert "wal-archive-prod-data:/wal-archive:rw" in compose
    assert "wal-archive-prod-data:/wal-archive:ro" in compose
    assert "WAL_OFFSITE_MARKER" in compose
    assert "WAL_ARCHIVE_KEEP_DAYS" in compose
    assert "check-rclone-crypt.sh" in compose
    assert "complete_archive_files" in wal_sync
    assert "--files-from \"$file_list\"" in wal_sync
    assert "????????.history" in wal_sync
    assert '"$WAL_ARCHIVE_DIR" "$OFFSITE_REMOTE/wal-archive"' in wal_sync
    assert 'WAL_OFFSITE_RUN_ONCE:-0' in wal_sync
    assert "ALERTER_MINIO_HEALTH_URL" in compose
    assert "ALERTER_CLAMAV_HOST" in compose
    assert "ALERTER_CLAMAV_PORT" in compose
    backend = compose.split("  backend:", 1)[1].split("  # ──", 1)[0]
    assert "minio:\n        condition: service_healthy" in backend
    alerter = compose.split("  alerter:", 1)[1].split("  # ──", 1)[0]
    assert "wal-offsite:" not in alerter.split("    environment:", 1)[0]
    for mount in (
        "./backup.sh:/app/backup.sh:ro",
        "./restore.sh:/app/restore.sh:ro",
        "./backup-lock.py:/usr/local/bin/tz-backup-lock.py:ro",
        "./cron/backup-timer.sh:/usr/local/bin/tz-backup-timer.sh:ro",
        "./cron/wal-offsite-sync.sh:/usr/local/bin/tz-wal-offsite-sync.sh:ro",
        "./cron/check-rclone-crypt.sh:/usr/local/bin/tz-check-rclone-crypt.sh:ro",
        "./alerter/alerter.py:/usr/local/bin/tz-alerter.py:ro",
    ):
        assert mount in compose
    assert 'condition: service_healthy' in compose
    assert "pg_is_in_recovery()" in compose
    assert "pg_stat_wal_receiver" in compose
    assert "172.30.0.0/24" in compose


def test_production_sidecar_liveness_checks_and_deploy_health_gate_match():
    compose = read_text(INFRA_ROOT / "docker-compose.prod.yml")
    deploy = read_text(INFRA_ROOT / "deploy.sh")
    sidecars = (
        ("backup-timer", "wal-offsite"),
        ("wal-offsite", "alerter"),
        ("alerter", "frontend"),
    )

    for service, next_service in sidecars:
        block = compose_service_block(compose, service, next_service)
        assert "kill -0 1" in block
        assert "/proc/1/cmdline" not in block
        assert "test -s /proc" not in block
        assert service in deploy.split("HEALTH_SERVICES=", 1)[1].split("\n", 1)[0]


def production_env_file() -> str:
    return "\n".join(
        (
            "POSTGRES_PASSWORD=database-value-for-contract-check",
            "REPL_PASSWORD=replication-value-for-contract-check",
            "MINIO_SECRET_KEY=storage-value-for-contract-check",
            "GRAFANA_ADMIN_PASSWORD=grafana-value-for-contract-check",
            "JWT_SECRET=",
            "NEXTAUTH_SECRET=",
            "",
        )
    )


def test_deploy_generates_256_bit_auth_secrets_without_logging_them(tmp_path):
    env_file = tmp_path / "production.env"
    env_file.write_text(production_env_file(), encoding="ascii")
    env = os.environ.copy()
    env.pop("JWT_SECRET", None)
    env.pop("NEXTAUTH_SECRET", None)
    env["ENV_FILE"] = str(env_file)

    result = subprocess.run(
        ["/bin/bash", str(INFRA_ROOT / "deploy.sh"), "--help"],
        cwd=INFRA_ROOT,
        env=env,
        check=False,
        capture_output=True,
        text=True,
    )

    values = dict(
        line.split("=", 1)
        for line in env_file.read_text(encoding="ascii").splitlines()
        if "=" in line
    )
    assert result.returncode == 0
    for key in ("JWT_SECRET", "NEXTAUTH_SECRET"):
        assert re.fullmatch(r"[0-9a-f]{64}", values[key])
        assert values[key] not in result.stdout + result.stderr


@pytest.mark.parametrize(
    ("key", "weak_value"),
    (("JWT_SECRET", "password"), ("JWT_SECRET", "short"), ("NEXTAUTH_SECRET", "default")),
)
def test_deploy_rejects_weak_operator_auth_secrets_without_echoing_them(tmp_path, key, weak_value):
    env_file = tmp_path / "production.env"
    env_file.write_text(production_env_file(), encoding="ascii")
    env = os.environ.copy()
    env["ENV_FILE"] = str(env_file)
    env[key] = weak_value

    result = subprocess.run(
        ["/bin/bash", str(INFRA_ROOT / "deploy.sh"), "--help"],
        cwd=INFRA_ROOT,
        env=env,
        check=False,
        capture_output=True,
        text=True,
    )

    assert result.returncode == 1
    assert key in result.stderr
    assert weak_value not in result.stdout + result.stderr


@pytest.mark.parametrize(
    ("filename", "primary_service", "replica_service", "next_replica"),
    [
        ("docker-compose.yml", "pg-primary", "pg-replica", "minio"),
        ("docker-compose.prod.yml", "db", "db-replica", "minio"),
    ],
)
def test_postgres_healthchecks_use_runtime_password_auth(
    filename, primary_service, replica_service, next_replica
):
    compose = read_text(INFRA_ROOT / filename)
    replica = compose_service_block(compose, replica_service, next_replica)

    assert 'PGPASSWORD="$${POSTGRES_PASSWORD}" pg_isready -q' in replica
    assert 'PGPASSWORD="$${POSTGRES_PASSWORD}" psql -X -w -U "$${POSTGRES_USER}"' in replica
    helper = read_text(INFRA_ROOT / "postgres" / "check-primary-health.sh")
    assert 'PGPASSWORD="$POSTGRES_PASSWORD" pg_isready -q' in helper
    assert 'PGPASSWORD="$POSTGRES_PASSWORD" psql -X -w' in helper


@pytest.mark.parametrize(
    ("filename", "primary_service", "replica_service", "next_replica"),
    [
        ("docker-compose.yml", "pg-primary", "pg-replica", "minio"),
        ("docker-compose.prod.yml", "db", "db-replica", "minio"),
    ],
)
def test_primary_healthchecks_parameterize_slot_over_stdin(
    filename, primary_service, replica_service, next_replica
):
    compose = read_text(INFRA_ROOT / filename)
    primary = compose_service_block(compose, primary_service, replica_service)
    replica = compose_service_block(compose, replica_service, next_replica)
    helper = read_text(INFRA_ROOT / "postgres" / "check-primary-health.sh")
    normalized_helper = " ".join(helper.split())
    normalized_primary = " ".join(primary.split())

    # psql не подставляет переменные, если SQL передан через -c.
    assert re.search(r"-Atqc\s+['\"].*?:'slot'", normalized_primary) is None
    assert (
        'test: ["CMD", "/bin/bash", "/usr/local/bin/check-primary-health.sh"]'
        in primary
    )
    assert (
        "./postgres/check-primary-health.sh:/usr/local/bin/check-primary-health.sh:ro"
        in primary
    )
    assert "case \"$REPL_SLOT\" in" in helper
    assert "printf '%s\\n'" in helper
    assert ":'slot'" in helper
    assert '-v "slot=$REPL_SLOT"' in normalized_helper
    assert "| PGPASSWORD=\"$POSTGRES_PASSWORD\" psql" in normalized_helper
    assert "-c" not in helper

    assert "pg_is_in_recovery()" in replica
    assert "pg_stat_wal_receiver" in replica
    assert "status = 'streaming'" in replica


def test_primary_healthcheck_helper_sends_slot_query_on_stdin(tmp_path):
    fake_bin = tmp_path / "bin"
    fake_bin.mkdir()
    psql_args = tmp_path / "psql-args"
    psql_sql = tmp_path / "psql-sql"
    ready_marker = tmp_path / "replication-ready"
    ready_marker.touch()
    write_executable(fake_bin / "pg_isready", "#!/bin/sh\nexit 0\n")
    write_executable(
        fake_bin / "psql",
        "#!/bin/sh\n"
        "printf '%s\\n' \"$*\" > \"$PSQL_ARGS\"\n"
        "cat > \"$PSQL_SQL\"\n"
        "printf 't\\n'\n",
    )
    env = os.environ.copy()
    env.update(
        {
            "PATH": f"{fake_bin}:{os.defpath}",
            "POSTGRES_USER": "technoz",
            "POSTGRES_PASSWORD": "db-password",
            "POSTGRES_DB": "technozrelost",
            "REPL_SLOT": "tz_replica_slot",
            "REPLICATION_READY_FILE": str(ready_marker),
            "PSQL_ARGS": str(psql_args),
            "PSQL_SQL": str(psql_sql),
        }
    )

    result = subprocess.run(
        ["/bin/bash", str(INFRA_ROOT / "postgres" / "check-primary-health.sh")],
        env=env,
        check=False,
        capture_output=True,
        text=True,
    )

    assert result.returncode == 0
    args = psql_args.read_text(encoding="ascii")
    assert "slot=tz_replica_slot" in args
    assert "-c" not in args
    assert ":'slot'" in psql_sql.read_text(encoding="ascii")


def test_replica_writes_a_private_escaped_passfile(tmp_path):
    fake_bin = tmp_path / "bin"
    fake_bin.mkdir()
    entrypoint_args = tmp_path / "entrypoint-args"
    write_executable(fake_bin / "chown", "#!/bin/sh\nexit 0\n")
    write_executable(
        fake_bin / "docker-entrypoint.sh",
        "#!/bin/sh\nprintf '%s\\n' \"$*\" > \"$ENTRYPOINT_ARGS\"\n",
    )
    pgdata = tmp_path / "data"
    pgdata.mkdir()
    (pgdata / "PG_VERSION").write_text("16\n", encoding="ascii")
    passfile = tmp_path / "runtime" / ".pgpass"
    password = 'synthetic:password\\with"quotes'
    env = os.environ.copy()
    env.update(
        {
            "PATH": f"{fake_bin}:{os.defpath}",
            "PGDATA": str(pgdata),
            "PGPRIMARY_HOST": "pg-primary",
            "PGPRIMARY_PORT": "5432",
            "REPL_USER": "replicator",
            "REPL_PASSWORD": password,
            "REPL_SLOT": "tz_replica_slot",
            "REPLICATION_PASSFILE": str(passfile),
            "ENTRYPOINT_ARGS": str(entrypoint_args),
        }
    )

    result = subprocess.run(
        ["/bin/bash", str(INFRA_ROOT / "postgres" / "start-replica.sh")],
        env=env,
        check=False,
        capture_output=True,
        text=True,
    )

    assert result.returncode == 0
    assert passfile.stat().st_mode & 0o777 == 0o600
    assert passfile.read_text(encoding="utf-8") == (
        '*:5432:*:replicator:synthetic\\:password\\\\with"quotes\n'
    )
    assert "password=" not in entrypoint_args.read_text(encoding="ascii")


def test_ensure_replication_sets_and_verifies_scram_credential_in_disposable_postgres():
    image = "pgvector/pgvector:0.8.0-pg16"
    if subprocess.run(
        ["docker", "info"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False
    ).returncode != 0:
        pytest.skip("Docker daemon unavailable")
    if subprocess.run(
        ["docker", "image", "inspect", image],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=False,
    ).returncode != 0:
        pytest.skip(f"Docker image unavailable: {image}")

    name = f"tz-repl-contract-{uuid.uuid4().hex}"
    env = os.environ.copy()
    env.update(
        {
            "POSTGRES_USER": "contract_admin",
            "POSTGRES_PASSWORD": "synthetic-admin-password",
            "POSTGRES_DB": "contract_db",
            "POSTGRES_HOST_AUTH_METHOD": "scram-sha-256",
            "REPL_USER": "contract_replicator",
            "REPL_PASSWORD": 'synthetic:repl\\password"with-space ',
            "REPL_SLOT": "contract_replica_slot",
        }
    )
    container = subprocess.run(
        [
            "docker",
            "run",
            "-d",
            "--rm",
            "--name",
            name,
            "--network",
            "none",
            "--tmpfs",
            "/var/lib/postgresql/data:uid=999,gid=999,mode=0700",
            "-e",
            "POSTGRES_USER",
            "-e",
            "POSTGRES_PASSWORD",
            "-e",
            "POSTGRES_DB",
            "-e",
            "POSTGRES_HOST_AUTH_METHOD",
            "-e",
            "REPL_USER",
            "-e",
            "REPL_PASSWORD",
            "-e",
            "REPL_SLOT",
            "-v",
            (
                f"{INFRA_ROOT / 'postgres' / 'ensure-replication.sh'}:"
                "/usr/local/bin/ensure-replication.sh:ro"
            ),
            image,
        ],
        env=env,
        check=False,
        capture_output=True,
        text=True,
    )
    assert container.returncode == 0
    try:
        for _ in range(30):
            ready = subprocess.run(
                [
                    "docker",
                    "exec",
                    name,
                    "/bin/bash",
                    "-ceu",
                    'pg_isready -q -U "$POSTGRES_USER" -d "$POSTGRES_DB"',
                ],
                check=False,
                capture_output=True,
                text=True,
            )
            if ready.returncode == 0:
                break
            time.sleep(1)
        else:
            pytest.fail("disposable PostgreSQL did not become ready")

        verified = subprocess.run(
            [
                "docker",
                "exec",
                name,
                "/bin/bash",
                "-ceu",
                "/usr/local/bin/ensure-replication.sh && "
                'PGPASSWORD="$REPL_PASSWORD" psql -X -w -h 127.0.0.1 '
                '-U "$REPL_USER" -d "$POSTGRES_DB" -c "SELECT 1" >/dev/null',
            ],
            check=False,
            capture_output=True,
            text=True,
        )
        assert verified.returncode == 0, verified.stderr
    finally:
        subprocess.run(
            ["docker", "stop", name],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        )


def test_compose_subnets_match_hba_and_are_non_overlapping():
    dev_subnet = compose_default_subnet(read_text(INFRA_ROOT / "docker-compose.yml"))
    prod_subnet = compose_default_subnet(read_text(INFRA_ROOT / "docker-compose.prod.yml"))

    assert not ipaddress.ip_network(dev_subnet).overlaps(ipaddress.ip_network(prod_subnet))
    for hba_name, subnet in (("pg_hba.dev.conf", dev_subnet), ("pg_hba.conf", prod_subnet)):
        hba = hba_records(read_text(INFRA_ROOT / "postgres" / hba_name))
        replication_cidrs = {
            record[3]
            for record in hba
            if len(record) == 5
            and record[0].startswith("host")
            and record[1] == "replication"
            and record[2] == "replicator"
        }
        assert subnet in replication_cidrs
        app_cidrs = {
            record[3]
            for record in hba
            if len(record) == 5
            and record[0].startswith("host")
            and record[1] == "all"
            and record[2] == "all"
            and record[4] == "scram-sha-256"
        }
        assert subnet in app_cidrs

        for record in hba:
            if len(record) == 5 and record[0].startswith("host") and record[1] == "replication":
                assert record[2] == "replicator"
                assert record[3] not in {"0.0.0.0/0", "::/0", "all"}
                assert record[4] == "scram-sha-256"

        assert ["local", "replication", "replicator", "scram-sha-256"] in hba
        assert ["local", "all", "postgres", "peer"] in hba
        assert ["local", "all", "all", "scram-sha-256"] in hba
        assert ["local", "all", "all", "trust"] not in hba


def test_dev_hba_allows_only_scram_docker_desktop_gateway_cidr():
    hba = read_text(INFRA_ROOT / "postgres" / "pg_hba.dev.conf")
    records = hba_records(hba)

    assert "192.168.65.0/24" in hba
    assert "192.168.65.1" in hba
    assert "trust" not in hba
    assert "0.0.0.0/0" not in hba
    assert "::/0" not in hba
    assert all(record[-1] in {"peer", "scram-sha-256"} for record in records)
    assert all(
        record[4] == "scram-sha-256"
        for record in records
        if len(record) == 5 and record[0].startswith("host")
    )


def test_production_hba_and_compose_exclude_docker_desktop_gateway():
    prod_hba = read_text(INFRA_ROOT / "postgres" / "pg_hba.conf")
    prod_compose = read_text(INFRA_ROOT / "docker-compose.prod.yml")
    dev_compose = read_text(INFRA_ROOT / "docker-compose.yml")

    assert "192.168.65." not in prod_hba
    assert "192.168.65." not in prod_compose
    assert "pg_hba.dev.conf" not in prod_compose
    assert prod_compose.count("./postgres/pg_hba.conf:/etc/postgresql/pg_hba.conf:ro") == 2
    assert dev_compose.count("./postgres/pg_hba.dev.conf:/etc/postgresql/pg_hba.conf:ro") == 2


def test_production_image_contains_runtime_infra_scripts():
    dockerfile = read_text(BACKEND_ROOT / "Dockerfile")

    assert "COPY infra/backup.sh ./infra/backup.sh" in dockerfile
    assert "COPY infra/restore.sh ./restore.sh" in dockerfile
    assert "COPY infra/backup-lock.py ./infra/backup-lock.py" in dockerfile
    assert "COPY infra/mc-host-url.py ./infra/mc-host-url.py" in dockerfile
    assert "COPY infra/cron ./infra/cron" in dockerfile
    assert "COPY infra/alerter ./infra/alerter" in dockerfile


def test_ensure_replication_uses_admin_password_from_environment(tmp_path):
    fake_bin = tmp_path / "bin"
    fake_bin.mkdir()
    psql_args = tmp_path / "psql-args"
    psql_sql = tmp_path / "psql-sql"
    write_executable(
        fake_bin / "psql",
        "#!/bin/sh\n"
        "case \"${PGPASSWORD:-}\" in admin-password|replica-password) ;; *) exit 1 ;; esac\n"
        "printf '%s\\n' \"$*\" > \"$PSQL_ARGS\"\n"
        "if [ \"${PGPASSWORD:-}\" = admin-password ]; then\n"
        "  cat > \"$PSQL_SQL\"\n"
        "else\n"
        "  cat >/dev/null\n"
        "fi\n",
    )
    env = os.environ.copy()
    env.update(
        {
            "PATH": f"{fake_bin}:{os.defpath}",
            "PSQL_ARGS": str(psql_args),
            "PSQL_SQL": str(psql_sql),
            "POSTGRES_USER": "technoz",
            "POSTGRES_PASSWORD": "admin-password",
            "POSTGRES_DB": "technozrelost",
            "REPL_USER": "replicator",
            "REPL_PASSWORD": "replica-password",
            "REPL_SLOT": "tz_replica_slot",
        }
    )

    result = subprocess.run(
        ["/bin/bash", str(INFRA_ROOT / "postgres" / "ensure-replication.sh")],
        env=env,
        check=False,
        capture_output=True,
        text=True,
    )

    assert result.returncode == 0
    args = psql_args.read_text(encoding="ascii")
    assert "admin-password" not in args
    assert "replica-password" not in args
    sql = psql_sql.read_text(encoding="utf-8")
    assert "\\getenv repl_password REPL_PASSWORD" in sql
    assert "replica-password" not in sql


def test_postgres_entrypoint_prepares_wal_archive_before_official_entrypoint():
    source = read_text(INFRA_ROOT / "alerter" / "postgres-primary-entrypoint.sh")

    assert 'WAL_ARCHIVE_DIR="${WAL_ARCHIVE_DIR:-/var/lib/postgresql/wal-archive}"' in source
    assert 'mkdir -p "$WAL_ARCHIVE_DIR"' in source
    assert 'chown -R postgres:postgres "$WAL_ARCHIVE_DIR"' in source
    assert 'chmod 700 "$WAL_ARCHIVE_DIR"' in source
    assert source.index('mkdir -p "$WAL_ARCHIVE_DIR"') < source.index("docker-entrypoint.sh")


def test_primary_first_and_existing_volume_paths_use_password_authentication():
    init = read_text(INFRA_ROOT / "postgres" / "init-primary.sh")
    start = read_text(INFRA_ROOT / "postgres" / "start-primary.sh")
    production_start = read_text(INFRA_ROOT / "alerter" / "postgres-primary-entrypoint.sh")
    ensure = read_text(INFRA_ROOT / "postgres" / "ensure-replication.sh")

    assert 'export PGPASSWORD="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD обязателен}"' in init
    for source in (start, production_start):
        assert (
            'export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD '
            'обязателен}"'
            in source
        )
        assert 'export PGPASSWORD="$POSTGRES_PASSWORD"' in source
        assert 'PGPASSWORD="$POSTGRES_PASSWORD" psql -X -w' in source
    assert 'PGPASSWORD="$POSTGRES_PASSWORD" psql' in ensure


def test_replica_uses_the_restricted_hba_policy():
    start_replica = read_text(INFRA_ROOT / "postgres" / "start-replica.sh")
    compose_policies = {
        "docker-compose.yml": "./postgres/pg_hba.dev.conf:/etc/postgresql/pg_hba.conf:ro",
        "docker-compose.prod.yml": "./postgres/pg_hba.conf:/etc/postgresql/pg_hba.conf:ro",
    }
    for filename, hba_mount in compose_policies.items():
        compose = read_text(INFRA_ROOT / filename)
        replica_service = (
            "pg-replica" if filename == "docker-compose.yml" else "db-replica"
        )
        replica = compose_service_block(compose, replica_service, "minio")
        assert hba_mount in replica
    assert '-c "hba_file=/etc/postgresql/pg_hba.conf"' in start_replica
    assert "PGPASSFILE" in start_replica


def test_dev_primary_receives_replication_environment():
    compose = read_text(INFRA_ROOT / "docker-compose.yml")
    primary = compose.split("  pg-primary:", 1)[1].split("  pg-replica:", 1)[0]
    replica = compose.split("  pg-replica:", 1)[1].split("  minio:", 1)[0]

    assert "REPL_USER: ${REPL_USER:-replicator}" in primary
    assert "REPL_PASSWORD: ${REPL_PASSWORD:-change_me}" in primary
    assert "REPL_SLOT: ${REPL_SLOT:-tz_replica_slot}" in primary
    for variable in (
        "REPL_USER: ${REPL_USER:-replicator}",
        "REPL_PASSWORD: ${REPL_PASSWORD:-change_me}",
        "REPL_SLOT: ${REPL_SLOT:-tz_replica_slot}",
    ):
        assert variable in replica
    assert "replica_pass" not in replica


def test_server_requirements_describe_current_offsite_and_observability_env():
    requirements = read_text(REPO_ROOT / "docs" / "СЕРВЕР-ТРЕБОВАНИЯ.md")
    env_example = read_text(INFRA_ROOT / ".env.production.example")

    assert "Storage remote" in requirements
    assert "type=crypt" in requirements
    for name in (
        "API_URL_INTERNAL",
        "NEXT_PUBLIC_API_URL",
        "TELEGRAM_BOT_TOKEN",
        "TELEGRAM_CHAT_ID",
        "ALERTER_MINIO_HEALTH_URL",
        "ALERTER_CLAMAV_HOST",
        "ALERTER_CLAMAV_PORT",
        "WAL_OFFSITE_MARKER",
        "WAL_OFFSITE_INTERVAL_SECONDS",
        "WAL_OFFSITE_MAX_AGE_SECONDS",
        "WAL_ARCHIVE_KEEP_DAYS",
    ):
        assert name in requirements
    assert "WAL_ARCHIVE_KEEP_DAYS=7" in env_example
    assert "TELEGRAM_BOT_TOKEN=" in env_example
    assert "TELEGRAM_CHAT_ID=" in env_example
    assert "Планируются" not in requirements


def test_ci_dependency_audit_is_pinned_and_runs_via_uv():
    workflow = read_text(REPO_ROOT / ".github" / "workflows" / "ci.yml")

    assert "uv sync --locked --extra dev" in workflow
    assert "uv run --extra dev --with pip-audit==2.9.0 pip-audit -l" in workflow
    assert "uv run pytest -q infra/alerter/test_alerter.py tests" in workflow


def test_pitr_archive_command_is_successful_when_segment_already_exists():
    pitr = read_text(INFRA_ROOT / "postgres" / "postgresql-pitr.conf")
    rehearsal = read_text(BACKEND_ROOT / "scripts" / "rehearse_pitr.sh")

    archive_command = (
        "archive_command = 'test -f /var/lib/postgresql/wal-archive/%f || "
        "(cp %p /var/lib/postgresql/wal-archive/.%f.tmp && "
        "mv /var/lib/postgresql/wal-archive/.%f.tmp /var/lib/postgresql/wal-archive/%f)'"
    )
    assert archive_command in pitr
    assert (
        "archive_command=test -f /walarchive/%f || (cp %p /walarchive/.%f.tmp && "
        "mv /walarchive/.%f.tmp /walarchive/%f)"
    ) in rehearsal
    assert "test ! -f" not in pitr
    assert "test ! -f" not in rehearsal


def test_pitr_archive_command_is_atomic_and_idempotent(tmp_path):
    archive = tmp_path / "archive"
    archive.mkdir()
    source = tmp_path / "source.wal"
    source.write_bytes(b"new WAL")
    target = archive / "segment"
    command = (
        f"test -f '{target}' || (cp '{source}' '{archive}/.segment.tmp' "
        f"&& mv '{archive}/.segment.tmp' '{target}')"
    )

    first = subprocess.run(["/bin/sh", "-c", command], check=False)
    assert first.returncode == 0
    assert target.read_bytes() == b"new WAL"

    target.write_bytes(b"existing WAL")
    second = subprocess.run(["/bin/sh", "-c", command], check=False)
    assert second.returncode == 0
    assert target.read_bytes() == b"existing WAL"


def test_replication_password_has_no_production_default():
    compose = read_text(INFRA_ROOT / "docker-compose.prod.yml")
    ensure_replication = read_text(INFRA_ROOT / "postgres" / "ensure-replication.sh")
    deploy = read_text(INFRA_ROOT / "deploy.sh")
    replica = read_text(INFRA_ROOT / "postgres" / "start-replica.sh")

    assert "replica_pass" not in compose
    assert 'REPL_PASSWORD="${REPL_PASSWORD:?REPL_PASSWORD обязателен}"' in ensure_replication
    assert (
        'POSTGRES_PASSWORD="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD '
        'обязателен}"'
        in ensure_replication
    )
    assert 'PGPASSWORD="$POSTGRES_PASSWORD" psql' in ensure_replication
    assert "-v repl_password" not in ensure_replication
    assert "\\getenv repl_password REPL_PASSWORD" in ensure_replication
    assert "psql_quote" not in ensure_replication
    assert '-S "$REPL_SLOT"' in replica
    assert "standby.signal" in replica
    assert "primary_conninfo" in replica
    assert "primary_slot_name" in replica
    assert "export PGPASSWORD" not in replica
    assert "require_replication_password" in deploy
    assert "require_production_secret POSTGRES_PASSWORD" in deploy
    assert "require_production_secret MINIO_SECRET_KEY" in deploy


def test_pg_hba_limits_replication_to_scram_and_compose_subnet():
    hba = read_text(INFRA_ROOT / "postgres" / "pg_hba.conf")
    records = hba_records(hba)
    assert "host    replication     replicator" in hba
    assert "172.30.0.0/24" in hba
    assert "172.31.0.0/24" not in hba
    assert "scram-sha-256" in hba
    assert "host    replication     all" not in hba
    assert "0.0.0.0/0" not in hba
    assert "::/0" not in hba
    assert ["local", "all", "postgres", "peer"] in records
    assert ["local", "all", "all", "trust"] not in records


def test_backup_lock_and_callers_use_nonblocking_shared_lock():
    lock = read_text(INFRA_ROOT / "backup-lock.py")
    entrypoint = read_text(INFRA_ROOT / "backend-entrypoint.sh")
    timer = read_text(INFRA_ROOT / "cron" / "backup-timer.sh")
    compose = read_text(INFRA_ROOT / "docker-compose.prod.yml")

    assert "pg_try_advisory_lock" in lock
    assert "BACKUP_SKIP_IF_MARKER_AFTER_NS" in lock
    assert "BACKUP_RUN_ID" in lock
    assert "BACKUP_PRE_MIGRATION_MARKER" in lock
    assert "backup-lock.py" in entrypoint
    assert "BACKUP_SKIP_IF_MARKER_AFTER_NS" in entrypoint
    assert 'python "$BACKUP_LOCK_SCRIPT" "$BACKUP_SCRIPT"' in timer
    assert "BACKUP_RUN_ID: ${IMAGE_TAG:-local}" in compose


def test_backup_lock_publishes_one_marker_per_image_run(tmp_path, monkeypatch):
    marker = tmp_path / "pre-migration.marker"
    lock = runpy.run_path(str(INFRA_ROOT / "backup-lock.py"))
    monkeypatch.setenv("BACKUP_RUN_ID", "sha-20260827")
    monkeypatch.setenv("BACKUP_PRE_MIGRATION_MARKER", str(marker))

    assert lock["migration_backup_already_done"]() is False
    assert lock["mark_migration_backup_done"]() is True
    assert lock["migration_backup_already_done"]() is True
    assert marker.read_text(encoding="ascii") == "sha-20260827\n"
    assert marker.stat().st_mode & 0o777 == 0o600

    monkeypatch.setenv("BACKUP_RUN_ID", "sha-20260828")
    assert lock["migration_backup_already_done"]() is False


def test_restore_is_exact_and_production_networked():
    restore = read_text(INFRA_ROOT / "restore.sh")
    runbook = read_text(INFRA_ROOT / "RUNBOOK-DATA.md")

    assert "mc mb --ignore-existing" in restore
    assert "--remove" in restore
    assert "client.remove_object" in restore
    assert 'PGPASSWORD="$DB_PASSWORD" pg_restore --no-password' in restore
    assert (
        'PGPASSWORD="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD обязателен}" '
        'pg_restore --no-password'
        in restore
    )
    assert "docker exec -i -e PGPASSWORD" not in restore
    assert "if not client.bucket_exists(bucket)" in restore
    assert "stop backend backup-timer wal-offsite alerter frontend nginx" in runbook
    assert "--no-deps -T --entrypoint /app/restore.sh" in runbook
    assert "MinIO restore сначала создаёт" in runbook


def test_rollback_operational_paths_are_explicit_and_not_app_mounts():
    compose = read_text(INFRA_ROOT / "docker-compose.prod.yml")

    assert "/usr/local/bin/tz-backup-lock.py" in compose
    assert "/usr/local/bin/tz-backup-timer.sh" in compose
    assert "/usr/local/bin/tz-wal-offsite-sync.sh" in compose
    assert "/usr/local/bin/tz-alerter.py" in compose
    assert "../app:/" not in compose
    assert "./app:/" not in compose
