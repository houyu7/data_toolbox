from __future__ import annotations

import cgi
import sys
import traceback
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from server import legacy_core as core
from developer_modules.core_architecture.backend.channel_registry import load_channel_api_routers
from developer_modules.core_architecture.backend import legacy_data_api
from developer_modules.exploration_validation.backend import api as exploration_validation_api
from developer_modules.interaction_data_management.backend import api as interaction_data_api
from developer_modules.multimodal_feature_analysis.backend import api as multimodal_feature_api


ROOT = Path(__file__).resolve().parent
STATIC_DIR = ROOT / "static"
DEVELOPER_MODULES_DIR = ROOT / "developer_modules"
CORE_FRONTEND_DIR = DEVELOPER_MODULES_DIR / "core_architecture" / "frontend"
CHANNEL_API_ROUTERS = load_channel_api_routers()


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/":
            return self.serve_file(CORE_FRONTEND_DIR / "index.html", "text/html")
        if parsed.path.startswith("/developer_modules/"):
            path = DEVELOPER_MODULES_DIR / parsed.path.removeprefix("/developer_modules/")
            return self.serve_file(path, self.content_type_for(path))
        if parsed.path.startswith("/static/"):
            path = STATIC_DIR / parsed.path.removeprefix("/static/")
            return self.serve_file(path, self.content_type_for(path))

        for router in (
            interaction_data_api,
            multimodal_feature_api,
            *CHANNEL_API_ROUTERS,
            legacy_data_api,
        ):
            if router.handle_get(self, parsed):
                return
        return core.response(self, 404, {"error": "Not found"})

    def do_POST(self):
        try:
            parsed = urlparse(self.path)
            if parsed.path == "/api/upload":
                return self.upload()
            body = core.read_json(self)
            for router in (
                interaction_data_api,
                multimodal_feature_api,
                exploration_validation_api,
                *CHANNEL_API_ROUTERS,
                legacy_data_api,
            ):
                if router.handle_post(self, parsed, body):
                    return
            return core.response(self, 404, {"error": "Not found"})
        except Exception as exc:
            return core.response(self, 500, {"error": str(exc), "trace": traceback.format_exc(limit=2)})

    def serve_file(self, path: Path, content_type: str):
        if not path.exists():
            return core.response(self, 404, {"error": "File not found"})
        raw = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", f"{content_type}; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def content_type_for(self, path: Path) -> str:
        return {
            ".css": "text/css",
            ".html": "text/html",
            ".js": "application/javascript",
            ".json": "application/json",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".gif": "image/gif",
            ".webp": "image/webp",
            ".svg": "image/svg+xml",
        }.get(path.suffix.lower(), "application/octet-stream")

    def upload(self):
        form = cgi.FieldStorage(fp=self.rfile, headers=self.headers, environ={"REQUEST_METHOD": "POST"})
        label = form.getfirst("label", "")
        custom_label = form.getfirst("custom_label", "")
        upload_mode = form.getfirst("upload_mode", "file")
        batch_dir = core.unique_dir(core.channel_base_dir(label, custom_label) / core.timestamp_folder_name())
        batch_dir.mkdir(parents=True, exist_ok=True)
        items = form["files"] if "files" in form else form["file"]
        if not isinstance(items, list):
            items = [items]
        saved_files = []
        for item in items:
            raw_relative = item.filename or "uploaded_file"
            parts = [part for part in Path(raw_relative.replace("\\", "/")).parts if part not in {"", ".", ".."}]
            if upload_mode == "folder" and len(parts) > 1:
                target = core.safe_join(batch_dir, *parts[1:])
            else:
                target = core.safe_join(batch_dir, parts[-1])
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(item.file.read())
            saved_files.append(core.dataset_id_for(target))
        return core.response(
            self,
            200,
            {
                "label": label,
                "custom_label": custom_label,
                "batch_dir": str(batch_dir),
                "saved_files": saved_files,
                "file_count": len(saved_files),
                "channels": core.channel_dashboard(),
            },
        )

    def log_message(self, fmt, *args):
        sys.stderr.write("%s\n" % (fmt % args))


def main():
    preferred = int(core.os.environ.get("PORT", "8765"))
    last_error: OSError | None = None
    for port in [preferred, 8766, 8767, 8768, 8769]:
        try:
            server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
            break
        except OSError as exc:
            last_error = exc
    else:
        raise RuntimeError(f"No available port for data toolbox: {last_error}")
    print(f"Data toolbox running at http://127.0.0.1:{port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
