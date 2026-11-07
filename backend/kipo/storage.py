"""config.json and sessions.json under $KIROCREW_HOME/apps/kipo/data."""
import json
import os
import threading

from . import KipoError


def default_data_dir():
    home = os.environ.get("KIROCREW_HOME") or os.path.expanduser("~/.kiro/crew")
    return os.path.join(home, "apps", "kipo", "data")


class Storage:
    def __init__(self, data_dir=None):
        self.data_dir = data_dir or default_data_dir()
        self._lock = threading.Lock()

    def _path(self, name):
        return os.path.join(self.data_dir, name)

    def _read(self, name, default):
        try:
            with open(self._path(name), encoding="utf-8") as f:
                return json.load(f)
        except FileNotFoundError:
            return default
        except (OSError, json.JSONDecodeError):
            raise KipoError(f"{name} in the KiPo data folder is unreadable", "storage_unreadable", 500)

    def _write(self, name, data):
        os.makedirs(self.data_dir, exist_ok=True)
        path = self._path(name)
        tmp = f"{path}.tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
            f.write("\n")
        os.replace(tmp, path)

    # -- config ---------------------------------------------------------

    def get_config(self):
        data = self._read("config.json", {"repos": []})
        repos = data.get("repos") if isinstance(data, dict) else None
        return {"repos": repos if isinstance(repos, list) else []}

    def save_config(self, config):
        with self._lock:
            self._write("config.json", config)
        return config

    def repo_path(self, slug):
        for repo in self.get_config()["repos"]:
            if repo.get("slug", "").lower() == slug.lower():
                return repo.get("path")
        return None

    # -- sessions -------------------------------------------------------

    @staticmethod
    def session_key(repo, number):
        return f"{repo}#{number}"

    def get_sessions(self, repo, number):
        data = self._read("sessions.json", {})
        sessions = data.get(self.session_key(repo, number)) if isinstance(data, dict) else None
        return sessions if isinstance(sessions, dict) else {}

    def all_sessions(self):
        """Every session name KiPo has started, across all initiatives."""
        data = self._read("sessions.json", {})
        if not isinstance(data, dict):
            return []
        names = []
        for entry in data.values():
            if isinstance(entry, dict):
                names += [v for v in entry.values() if isinstance(v, str) and v not in names]
        return names

    def record_session(self, repo, number, key, slot_name):
        with self._lock:
            data = self._read("sessions.json", {})
            if not isinstance(data, dict):
                data = {}
            entry = data.setdefault(self.session_key(repo, number), {})
            entry[key] = slot_name
            self._write("sessions.json", data)
