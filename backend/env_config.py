import os
from pathlib import Path


def _parse_env_line(line):
    stripped = line.strip()
    if not stripped or stripped.startswith("#"):
        return None

    if stripped.startswith("export "):
        stripped = stripped[len("export ") :].strip()

    if "=" not in stripped:
        return None

    key, value = stripped.split("=", 1)
    key = key.strip()
    value = value.strip()

    if not key:
        return None

    if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
        value = value[1:-1]

    return key, value


def _load_env_file(path):
    if not path.exists():
        return

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        parsed = _parse_env_line(raw_line)
        if not parsed:
            continue

        key, value = parsed
        os.environ.setdefault(key, value)


def load_env_files():
    backend_dir = Path(__file__).resolve().parent
    candidates = [
        backend_dir / ".env",
        backend_dir.parent / ".env",
    ]

    for candidate in candidates:
        _load_env_file(candidate)
