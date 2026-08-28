#!/usr/bin/env python3
"""Формирует MC_HOST_* URL из credentials, не принимая их через argv."""

from __future__ import annotations

import os
import sys
from urllib.parse import quote, urlsplit, urlunsplit


def main() -> int:
    try:
        endpoint = os.environ["MINIO_URL"]
        access_key = os.environ["MINIO_ACCESS_KEY"]
        secret_key = os.environ["MINIO_SECRET_KEY"]
        parsed = urlsplit(endpoint)
        hostname = parsed.hostname
        if not parsed.scheme or not hostname:
            raise ValueError
        if ":" in hostname and not hostname.startswith("["):
            hostname = f"[{hostname}]"
        netloc = f"{quote(access_key, safe='')}:{quote(secret_key, safe='')}@{hostname}"
        if parsed.port is not None:
            netloc = f"{netloc}:{parsed.port}"
        print(urlunsplit((parsed.scheme, netloc, parsed.path, parsed.query, parsed.fragment)))
    except (KeyError, ValueError):
        print("invalid MinIO endpoint or credentials", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
