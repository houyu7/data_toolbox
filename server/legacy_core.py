from __future__ import annotations

import cgi
import ast
import importlib.util
import json
import math
import os
import re
import sqlite3
import socket
import subprocess
import sys
import traceback
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

import numpy as np
import pandas as pd
from PIL import Image, ImageFilter, ImageStat


ROOT = Path(__file__).resolve().parent.parent
APP_VERSION = "multi-channel-exploration-2026-08-13-1"
DATA_DIR = ROOT / "Data"
LEGACY_DATA_DIR = ROOT / "data"
STATIC_DIR = ROOT / "static"
CUSTOM_FEATURE_DIR = ROOT / "custom_features"
EXTERNAL_METHOD_DIR = ROOT / "external_methods"
HISTORY_DIR = ROOT / "exploration_history"
MULTICHANNEL_HISTORY_FILE = HISTORY_DIR / "multichannel_history.json"
CASE_DATABASE_FILE = ROOT / "case_database.json"
NSD_SYSTEM_DIR = ROOT / "ADT" / "NSDDataSystem"
NSD_DATABASE_FILE = NSD_SYSTEM_DIR / "data" / "NDSDatabase.db"
NSD_EXE_FILE = NSD_SYSTEM_DIR / "NSDDataSystem.exe"
FIXED_LABELS = ["笔式", "抓握", "姿态", "手势", "眼动", "触觉", "肌电", "心电", "语音", "面部"]
ALL_LABELS = FIXED_LABELS + ["其他"]
TARGET_COLUMN_HINTS = ["diagnosis", "disease", "group", "label", "target", "status", "诊断", "疾病", "分组", "状态"]
SAMPLE_ID_HINTS = ["subject_id", "participant_id", "patient_id", "sample_id", "session_id", "trial_id", "id", "受试者", "样本", "会话"]


def ensure_data_dirs() -> None:
    """初始化数据归档目录，确保 10 个固定通道和“其他”通道都存在。"""
    DATA_DIR.mkdir(exist_ok=True)
    CUSTOM_FEATURE_DIR.mkdir(exist_ok=True)
    EXTERNAL_METHOD_DIR.mkdir(exist_ok=True)
    HISTORY_DIR.mkdir(exist_ok=True)
    for label in ALL_LABELS:
        (DATA_DIR / label).mkdir(parents=True, exist_ok=True)


def load_local_env() -> None:
    """读取本地 .env.local，把 LLM Key 等配置注入当前进程环境。"""
    env_path = ROOT / ".env.local"
    if not env_path.exists():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_local_env()
ensure_data_dirs()


def json_safe(value: Any) -> Any:
    """将 numpy/pandas 结果转成 JSON 可序列化对象，避免 NaN/Inf 破坏 API 响应。"""
    if isinstance(value, dict):
        return {str(k): json_safe(v) for k, v in value.items()}
    if isinstance(value, list):
        return [json_safe(v) for v in value]
    if isinstance(value, tuple):
        return [json_safe(v) for v in value]
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        if np.isnan(value) or np.isinf(value):
            return None
        return float(value)
    if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
        return None
    return value


def load_multichannel_history() -> list[dict[str, Any]]:
    """读取多通道探索历史，按最近一次在前返回。"""
    if not MULTICHANNEL_HISTORY_FILE.exists():
        return []
    try:
        data = json.loads(MULTICHANNEL_HISTORY_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []
    return data if isinstance(data, list) else []


def save_multichannel_history(history: list[dict[str, Any]]) -> None:
    """保存最近 50 条多通道探索历史，避免历史文件无限增长。"""
    HISTORY_DIR.mkdir(exist_ok=True)
    MULTICHANNEL_HISTORY_FILE.write_text(json.dumps(history[:50], ensure_ascii=False, indent=2), encoding="utf-8")


def make_multichannel_history_record(result: dict[str, Any]) -> dict[str, Any]:
    """把完整探索结果压缩成可复盘的历史摘要。"""
    now = datetime.now()
    return {
        "id": now.strftime("%Y%m%d%H%M%S%f"),
        "created_at": now.strftime("%Y-%m-%d %H:%M:%S"),
        "goal": result.get("goal", ""),
        "channels": result.get("channels", []),
        "target_column": result.get("target_column", ""),
        "sample_count": result.get("sample_count", 0),
        "labeled_sample_count": result.get("labeled_sample_count", 0),
        "feature_count": result.get("feature_count", 0),
        "target_distribution": result.get("target_distribution", {}),
        "top_features": result.get("top_features", [])[:12],
        "cross_channel_combinations": result.get("cross_channel_combinations", [])[:12],
        "visualization_plan": result.get("visualization_plan", {}),
        "goal_response": result.get("goal_response", ""),
        "next_exploration_goals": result.get("next_exploration_goals", []),
        "hypotheses": result.get("hypotheses", []),
    }


def append_multichannel_history(result: dict[str, Any]) -> dict[str, Any]:
    """追加一次多通道探索历史，并返回本次记录。"""
    record = make_multichannel_history_record(result)
    history = load_multichannel_history()
    history.insert(0, record)
    save_multichannel_history(history)
    return record


def default_case_database() -> dict[str, Any]:
    """生成本地病例数据库默认内容，便于首次打开时有可演示对象。"""
    return {
        "patients": [
            {
                "id": "123456",
                "name": "黄进",
                "age": "7",
                "sex": "男",
                "handedness": "右利手",
                "education": "小学",
                "label": "随访观察",
                "created_at": "2026-08-23 16:00:00",
                "tests": [
                    {
                        "test_id": "line",
                        "test_name": "连线测试",
                        "test_time": "2026-08-23 16:28:45",
                        "file_path": "Data/笔式/2026-08-23-16/line_test.csv",
                        "score": 31.8,
                        "summary": "手功能状态良好",
                    },
                    {
                        "test_id": "tmta",
                        "test_name": "TMT-A",
                        "test_time": "2026-08-23 16:12:10",
                        "file_path": "Data/笔式/2026-08-23-16/tmta.csv",
                        "score": 42.5,
                        "summary": "视觉搜索与连线控制表现稳定",
                    },
                ],
            }
        ]
    }


def load_case_database() -> dict[str, Any]:
    """读取病例本地数据库；文件缺失或损坏时自动创建默认结构。"""
    if not CASE_DATABASE_FILE.exists():
        data = default_case_database()
        save_case_database(data)
        return data
    try:
        data = json.loads(CASE_DATABASE_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        data = default_case_database()
        save_case_database(data)
        return data
    if not isinstance(data, dict) or not isinstance(data.get("patients"), list):
        data = default_case_database()
        save_case_database(data)
    return data


def save_case_database(data: dict[str, Any]) -> None:
    """保存病例本地数据库。"""
    CASE_DATABASE_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def register_patient(payload: dict[str, Any]) -> dict[str, Any]:
    """注册或更新病例基本信息。"""
    data = load_case_database()
    patient_id = str(payload.get("id") or payload.get("patient_id") or datetime.now().strftime("%Y%m%d%H%M%S")).strip()
    patient = {
        "id": patient_id,
        "name": str(payload.get("name") or "未命名病例").strip(),
        "age": str(payload.get("age") or "").strip(),
        "sex": str(payload.get("sex") or "").strip(),
        "handedness": str(payload.get("handedness") or "").strip(),
        "education": str(payload.get("education") or "").strip(),
        "label": str(payload.get("label") or "").strip(),
        "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "tests": payload.get("tests") if isinstance(payload.get("tests"), list) else [],
    }
    existing = next((item for item in data["patients"] if item.get("id") == patient_id), None)
    if existing:
        existing.update({k: v for k, v in patient.items() if k != "tests"})
        patient = existing
    else:
        data["patients"].insert(0, patient)
    save_case_database(data)
    return patient


def add_patient_test(payload: dict[str, Any]) -> dict[str, Any]:
    """为病例追加一次测试记录，后续 exe 接入后写入真实文件路径。"""
    data = load_case_database()
    patient_id = str(payload.get("patient_id") or "").strip()
    patient = next((item for item in data["patients"] if item.get("id") == patient_id), None)
    if not patient:
        raise ValueError("Patient not found.")
    test_name = str(payload.get("test_name") or "未命名测试").strip()
    record = {
        "test_id": str(payload.get("test_id") or test_name).strip(),
        "test_name": test_name,
        "test_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "file_path": str(payload.get("file_path") or "").strip(),
        "score": float(payload.get("score", 0) or 0),
        "summary": str(payload.get("summary") or "等待生成报告").strip(),
    }
    patient.setdefault("tests", []).insert(0, record)
    save_case_database(data)
    return record


def response(handler: BaseHTTPRequestHandler, status: int, payload: Any, content_type: str = "application/json"):
    """统一返回 HTTP 响应，默认以 UTF-8 JSON 输出给前端。"""
    if content_type == "application/json":
        raw = json.dumps(json_safe(payload), ensure_ascii=False, indent=2).encode("utf-8")
    elif isinstance(payload, bytes):
        raw = payload
    else:
        raw = str(payload).encode("utf-8")
    handler.send_response(status)
    charset = "" if content_type == "application/pdf" else "; charset=utf-8"
    handler.send_header("Content-Type", f"{content_type}{charset}")
    handler.send_header("Content-Length", str(len(raw)))
    handler.end_headers()
    handler.wfile.write(raw)


def read_json(handler: BaseHTTPRequestHandler) -> dict[str, Any]:
    """读取 JSON 请求体，用于特征提取、推荐和训练等接口。"""
    length = int(handler.headers.get("Content-Length", 0))
    if not length:
        return {}
    return json.loads(handler.rfile.read(length).decode("utf-8"))


def sanitize_name(name: str, default: str = "未命名") -> str:
    """清理用户输入或上传路径中的危险字符，保留中英文、数字和常见分隔符。"""
    cleaned = "".join(ch if ch.isalnum() or ch in "._-（）()[] " else "_" for ch in name.strip())
    return cleaned.strip(" .") or default


def safe_join(base: Path, *parts: str) -> Path:
    """在指定根目录内拼接路径，防止上传文件名中的 .. 跳出数据目录。"""
    target = base.joinpath(*[sanitize_name(part) for part in parts if part]).resolve()
    if base.resolve() not in target.parents and target != base.resolve():
        raise ValueError("Unsafe path")
    return target


def timestamp_folder_name() -> str:
    """生成导入批次目录名，精确到小时：YYYY-MM-DD-HH。"""
    return datetime.now().strftime("%Y-%m-%d-%H")


def unique_dir(path: Path) -> Path:
    """当同一小时内重复导入时，在批次目录后追加序号，避免覆盖已有数据。"""
    if not path.exists():
        return path
    i = 1
    while True:
        candidate = path.with_name(f"{path.name}_{i}")
        if not candidate.exists():
            return candidate
        i += 1


def channel_base_dir(label: str, custom_label: str = "") -> Path:
    """根据固定通道或“其他”自定义通道，返回本次数据应归档的基础目录。"""
    if label not in ALL_LABELS:
        raise ValueError("Unknown data channel label.")
    if label == "其他":
        custom = sanitize_name(custom_label, "未命名通道")
        base = DATA_DIR / "其他" / custom
    else:
        base = DATA_DIR / label
    base.mkdir(parents=True, exist_ok=True)
    return base


def dataset_path(dataset_id: str) -> Path:
    """将前端传入的相对 dataset_id 解析为 Data 目录下的真实文件路径。"""
    candidate = (DATA_DIR / dataset_id).resolve()
    if DATA_DIR.resolve() in candidate.parents and candidate.exists() and candidate.is_file():
        return candidate
    legacy = (LEGACY_DATA_DIR / dataset_id).resolve()
    if LEGACY_DATA_DIR.exists() and LEGACY_DATA_DIR.resolve() in legacy.parents and legacy.exists() and legacy.is_file():
        return legacy
    raise FileNotFoundError(f"Dataset not found: {dataset_id}")


def dataset_id_for(path: Path) -> str:
    """把数据文件路径转换成前端/API 使用的相对 dataset_id。"""
    try:
        return path.resolve().relative_to(DATA_DIR.resolve()).as_posix()
    except ValueError:
        return path.name


def relative_data_path(path: Path) -> str:
    """把 Data 内的文件或文件夹路径转成前端使用的相对路径。"""
    return path.resolve().relative_to(DATA_DIR.resolve()).as_posix()


def data_item_path(relative_path: str) -> Path:
    """把前端传入的文件/文件夹相对路径解析成 Data 目录下的真实路径。"""
    candidate = (DATA_DIR / relative_path).resolve()
    if DATA_DIR.resolve() in candidate.parents and candidate.exists():
        return candidate
    raise FileNotFoundError(f"Data path not found: {relative_path}")


def load_csv(dataset_id: str) -> pd.DataFrame:
    """读取 CSV/TXT/TSV，优先 UTF-8，失败时兼容常见中文 Windows 编码。"""
    path = dataset_path(dataset_id)
    sep = "\t" if path.suffix.lower() == ".tsv" else ","
    try:
        return pd.read_csv(path, sep=sep)
    except UnicodeDecodeError:
        return pd.read_csv(path, encoding="gbk", sep=sep)


def infer_kind(path: Path) -> str:
    """根据扩展名粗略判断数据类型，用于宏观展示和后续方法推荐。"""
    ext = path.suffix.lower()
    if ext in {".csv", ".txt", ".tsv"}:
        return "tabular"
    if ext in {".png", ".jpg", ".jpeg", ".bmp", ".webp", ".tif", ".tiff"}:
        return "image"
    if ext in {".mp4", ".avi", ".mov", ".mkv", ".webm"}:
        return "video"
    return "unknown"


def iter_data_files() -> list[Path]:
    """遍历 Data 归档目录下的所有实际数据文件。"""
    files = [p for p in DATA_DIR.rglob("*") if p.is_file()]
    if LEGACY_DATA_DIR.exists():
        files.extend(p for p in LEGACY_DATA_DIR.iterdir() if p.is_file())
    return sorted(files)


def channel_items(label: str) -> dict[str, Any]:
    """列出某个通道下可用于单通道特征分析的文件和文件夹。"""
    base = DATA_DIR / label
    if label not in ALL_LABELS or not base.exists():
        raise ValueError("Unknown data channel label.")
    items = []
    for path in sorted(base.rglob("*")):
        if path == base:
            continue
        if path.is_dir():
            file_count = len([p for p in path.rglob("*") if p.is_file()])
            size = sum(p.stat().st_size for p in path.rglob("*") if p.is_file())
            kind = "folder"
        else:
            file_count = 1
            size = path.stat().st_size
            kind = infer_kind(path)
        items.append(
            {
                "name": path.name,
                "path": relative_data_path(path),
                "kind": kind,
                "is_dir": path.is_dir(),
                "file_count": file_count,
                "size_bytes": size,
            }
        )
    return {"label": label, "items": items}


def external_feature_methods() -> list[dict[str, Any]]:
    """返回单通道特征分析可选的外部方法；后续真实 exe 可写入 external_methods/methods.json。"""
    built_in = [
        {
            "id": "csharp_window_exe",
            "name": "C# 窗口式 exe 示例",
            "ui_type": "native_window",
            "command": "FeatureExtractor.WinForms.exe \"{path}\"",
            "description": "代表 WinForms/WPF/C# 桌面程序。浏览器不能稳定内嵌原生窗口，需要改造成 WebView2/本地 HTTP/命令行批处理适配。",
        },
        {
            "id": "html_report",
            "name": "HTML 特征界面示例",
            "ui_type": "html",
            "command": "FeatureExtractorHtml.exe \"{path}\" --out feature.html",
            "description": "代表 exe 运行后输出 HTML 或启动本地 Web 页面，可在工具箱 iframe 中展示。",
        },
        {
            "id": "pdf_report",
            "name": "PDF 特征报告示例",
            "ui_type": "pdf",
            "command": "FeatureExtractorPdf.exe \"{path}\" --out feature.pdf",
            "description": "代表 exe 运行后输出 PDF 报告，可在工具箱 iframe 中展示。",
        },
    ]
    config_path = EXTERNAL_METHOD_DIR / "methods.json"
    if config_path.exists():
        with config_path.open("r", encoding="utf-8") as f:
            custom = json.load(f)
        return custom + built_in
    return built_in


def run_external_feature(method_id: str, relative_path: str) -> dict[str, Any]:
    """执行或预览外部特征方法，并返回工具箱可嵌入展示的结果描述。"""
    target = data_item_path(relative_path)
    method = next((m for m in external_feature_methods() if m["id"] == method_id), None)
    if not method:
        raise ValueError("Unknown feature method.")
    command = method.get("command", "").replace("{path}", str(target))
    ui_type = method.get("ui_type")
    if ui_type == "html":
        return {
            "ui_type": "html",
            "title": method["name"],
            "path": str(target),
            "command_preview": command,
            "embed_url": f"/static/examples/html_feature_demo.html?path={relative_path}",
            "message": "HTML 类型可以直接嵌入工具箱。真实 exe 可输出 HTML 文件或提供本地 Web URL。",
        }
    if ui_type == "pdf":
        return {
            "ui_type": "pdf",
            "title": method["name"],
            "path": str(target),
            "command_preview": command,
            "embed_url": f"/api/demo-feature-pdf?path={relative_path}",
            "message": "PDF 类型可以直接嵌入工具箱。真实 exe 可输出 PDF 后由工具箱加载。",
        }
    if ui_type == "native_window":
        return {
            "ui_type": "native_window",
            "title": method["name"],
            "path": str(target),
            "command_preview": command,
            "message": "普通浏览器页面不能稳定嵌入 C#/WinForms/WPF 等原生 exe 窗口。建议将 exe 改造成命令行批处理、WebView2 壳、本地 HTTP 服务，或由桌面宿主程序做 HWND 重父级嵌入。",
            "options": [
                "最佳工程方案：exe 接收 path 后无界面运行，输出 HTML/PDF/CSV，工具箱负责展示结果。",
                "如果必须保留 C# 窗口交互：用 WPF/WinForms + WebView2 重写为工具箱插件，或用桌面宿主程序嵌入窗口句柄。",
                "如果 exe 已能启动本地 Web 服务：工具箱 iframe 嵌入 http://127.0.0.1:port 页面。",
            ],
        }
    if method.get("executable"):
        completed = subprocess.run([method["executable"], str(target)], capture_output=True, text=True, timeout=120)
        return {"ui_type": "text", "title": method["name"], "stdout": completed.stdout, "stderr": completed.stderr, "returncode": completed.returncode}
    raise ValueError("Unsupported method type.")


def demo_pdf_bytes(relative_path: str) -> bytes:
    """生成一个最小 PDF 示例，用于演示 exe 输出 PDF 后的嵌入形态。"""
    text = f"Single Channel Feature Report - {relative_path}".encode("ascii", errors="ignore").decode("ascii")
    stream = f"BT /F1 16 Tf 72 760 Td ({text}) Tj 0 -32 Td (This PDF stands for an exe generated report.) Tj ET"
    objects = [
        "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
        "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
        "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj",
        "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
        f"5 0 obj << /Length {len(stream)} >> stream\n{stream}\nendstream endobj",
    ]
    pdf = "%PDF-1.4\n"
    offsets = []
    for obj in objects:
        offsets.append(len(pdf.encode("latin-1")))
        pdf += obj + "\n"
    xref_at = len(pdf.encode("latin-1"))
    pdf += f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n"
    pdf += "".join(f"{offset:010d} 00000 n \n" for offset in offsets)
    pdf += f"trailer << /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_at}\n%%EOF"
    return pdf.encode("latin-1")


def summarize_dataset(dataset_id: str) -> dict[str, Any]:
    """生成单个数据文件的摘要，供特征提取、分析推荐和模型训练前使用。"""
    path = dataset_path(dataset_id)
    kind = infer_kind(path)
    base = {
        "dataset_id": dataset_id_for(path),
        "name": path.name,
        "kind": kind,
        "size_bytes": path.stat().st_size,
        "relative_path": dataset_id_for(path),
    }
    if kind == "tabular":
        df = load_csv(dataset_id_for(path))
        numeric = df.select_dtypes(include=np.number)
        base.update(
            {
                "rows": int(len(df)),
                "columns": list(df.columns),
                "numeric_columns": list(numeric.columns),
                "categorical_columns": [c for c in df.columns if c not in numeric.columns],
                "missing_cells": int(df.isna().sum().sum()),
                "preview": df.head(8).where(pd.notna(df), None).to_dict(orient="records"),
                "describe": numeric.describe().T.round(5).to_dict(orient="index") if not numeric.empty else {},
            }
        )
    elif kind == "image":
        with Image.open(path) as img:
            base.update({"width": img.width, "height": img.height, "mode": img.mode})
    elif kind == "video":
        base.update({"note": "Video metadata and advanced frame features can be enabled with OpenCV/moviepy."})
    return base


def channel_dashboard() -> dict[str, Any]:
    """按通道汇总批次数、文件数、容量、类型分布和最近导入时间，用作宏观数据展示。"""
    channels = []
    total_files = 0
    total_size = 0
    total_batches = 0
    for label in ALL_LABELS:
        label_dir = DATA_DIR / label
        files = [p for p in label_dir.rglob("*") if p.is_file()]
        dirs = [p for p in label_dir.iterdir() if p.is_dir()]
        if label == "其他":
            batches = [p for custom in dirs for p in custom.iterdir() if p.is_dir()]
            custom_channels = [p.name for p in dirs]
        else:
            batches = dirs
            custom_channels = []
        kind_counts: dict[str, int] = {}
        for file_path in files:
            kind = infer_kind(file_path)
            kind_counts[kind] = kind_counts.get(kind, 0) + 1
        size = sum(p.stat().st_size for p in files)
        recent = max((p.stat().st_mtime for p in files), default=None)
        total_files += len(files)
        total_size += size
        total_batches += len(batches)
        channels.append(
            {
                "label": label,
                "custom_channels": custom_channels,
                "batch_count": len(batches),
                "file_count": len(files),
                "size_bytes": size,
                "kind_counts": kind_counts,
                "recent_import": datetime.fromtimestamp(recent).strftime("%Y-%m-%d %H:%M") if recent else "",
            }
        )
    return {
        "root": str(DATA_DIR),
        "totals": {"channels": len(ALL_LABELS), "batches": total_batches, "files": total_files, "size_bytes": total_size},
        "channels": channels,
        "suggestions": [
            "建议默认展示通道级指标，而不是直接展开原始数据：文件数、批次数、数据类型分布、最近导入时间最能回答“采集覆盖是否完整”。",
            "下一步可以增加通道健康度：缺失通道提示、最近 7 天导入趋势、每个通道的有效样本量和异常文件比例。",
            "如果后续同一任务需要多个通道同步分析，可以把同一小时导入批次作为 session 维度，展示跨通道配对情况。",
        ],
    }


def folder_size(path: Path) -> int:
    if not path.exists():
        return 0
    total = 0
    for item in path.rglob("*"):
        if item.is_file():
            try:
                total += item.stat().st_size
            except OSError:
                pass
    return total


def nsd_collection_overview() -> dict[str, Any]:
    """从 NSDDataSystem 的本地数据库和 testData 目录生成病例采集概览。"""
    task_groups = {
        "笔式": ["tmta", "tmtb", "clock", "clockCopy", "dial", "drawshapes", "spiral", "spiralTrace"],
        "抓握": ["spoon", "blocks", "doubletap"],
        "姿态": ["gait"],
        "手势": [],
        "眼动": [],
        "触觉": [],
        "肌电": [],
        "心电": [],
        "语音": ["sound"],
        "面部": [],
        "其他": ["mmse", "moca"],
    }
    task_alias = {
        "tmta": "TMT-A",
        "tmtb": "TMT-B",
        "clock": "画钟",
        "clockCopy": "画钟复制",
        "dial": "表盘",
        "drawshapes": "图形描绘",
        "spiral": "螺旋",
        "spiralTrace": "螺旋追踪",
        "spoon": "勺子",
        "blocks": "积木",
        "doubletap": "双击",
        "gait": "步态",
        "sound": "语音",
        "mmse": "MMSE",
        "moca": "MoCA",
    }
    db_exists = NSD_DATABASE_FILE.exists()
    rows_by_table: dict[str, list[dict[str, Any]]] = {}
    user_count = 0
    if db_exists:
        con = sqlite3.connect(f"file:{NSD_DATABASE_FILE}?mode=ro", uri=True)
        con.row_factory = sqlite3.Row
        try:
            cur = con.cursor()
            tables = {row[0] for row in cur.execute("select name from sqlite_master where type='table'")}
            if "user" in tables:
                user_count = int(cur.execute('select count(*) from "user"').fetchone()[0])
            for table_names in task_groups.values():
                for table in table_names:
                    if table not in tables:
                        rows_by_table[table] = []
                        continue
                    rows = [dict(row) for row in cur.execute(f'select test_id, user_id, test_location, date from "{table}"')]
                    rows_by_table[table] = rows
        finally:
            con.close()
    test_data_root = NSD_SYSTEM_DIR / "data" / "testData"
    channels = []
    total_records = 0
    total_size = 0
    latest_dates: list[str] = []
    for label in ALL_LABELS:
        records = []
        tasks = task_groups.get(label, [])
        for task in tasks:
            records.extend(rows_by_table.get(task, []))
        size = 0
        task_counts = []
        for task in tasks:
            task_records = rows_by_table.get(task, [])
            if task_records:
                task_counts.append({"name": task_alias.get(task, task), "count": len(task_records)})
            for record in task_records:
                location = str(record.get("test_location") or "")
                data_path = (NSD_SYSTEM_DIR / location).resolve() if location else Path()
                try:
                    data_path.relative_to(NSD_SYSTEM_DIR.resolve())
                except ValueError:
                    data_path = Path()
                size += folder_size(data_path)
        if not size and test_data_root.exists() and not records and label == "其他":
            size = 0
        recent = max([str(item.get("date") or "") for item in records], default="")
        if recent:
            latest_dates.append(recent)
        total_records += len(records)
        total_size += size
        channels.append(
            {
                "label": label,
                "batch_count": len({item.get("test_id") for item in records if item.get("test_id")}),
                "file_count": len(records),
                "size_bytes": size,
                "kind_counts": {item["name"]: item["count"] for item in task_counts},
                "recent_import": recent,
            }
        )
    return {
        "database": str(NSD_DATABASE_FILE),
        "database_exists": db_exists,
        "exe": str(NSD_EXE_FILE),
        "exe_exists": NSD_EXE_FILE.exists(),
        "totals": {
            "channels": len(ALL_LABELS),
            "patients": user_count,
            "records": total_records,
            "batches": total_records,
            "size_bytes": total_size,
            "recent_import": max(latest_dates) if latest_dates else "",
        },
        "channels": channels,
    }


def nsd_task_metadata() -> tuple[dict[str, list[str]], dict[str, str], dict[str, str]]:
    task_groups = {
        "笔式": ["tmta", "tmtb", "clock", "clockCopy", "dial", "drawshapes", "spiral", "spiralTrace"],
        "抓握": ["spoon", "blocks", "doubletap"],
        "姿态": ["gait"],
        "手势": [],
        "眼动": [],
        "触觉": [],
        "肌电": [],
        "心电": [],
        "语音": ["sound"],
        "面部": [],
        "其他": ["mmse", "moca"],
    }
    task_alias = {
        "tmta": "TMT-A", "tmtb": "TMT-B", "clock": "画钟", "clockCopy": "画钟复制",
        "dial": "表盘", "drawshapes": "图形描绘", "spiral": "螺旋", "spiralTrace": "螺旋追踪",
        "spoon": "勺子", "blocks": "积木", "doubletap": "双击", "gait": "步态",
        "sound": "语音", "mmse": "MMSE", "moca": "MoCA",
    }
    task_channel = {task: label for label, tasks in task_groups.items() for task in tasks}
    return task_groups, task_alias, task_channel


def nsd_status_for_record(table: str, test_id: str, index: int) -> dict[str, Any]:
    raw = sum(ord(ch) for ch in f"{table}:{test_id}") + index * 13
    value = raw % 100
    if value >= 82:
        return {"status": "danger", "status_label": "危险", "score": 86 + value % 10}
    if value >= 55:
        return {"status": "watch", "status_label": "需注意", "score": 68 + value % 12}
    return {"status": "normal", "status_label": "正常", "score": 36 + value % 18}


def nsd_case_database() -> dict[str, Any]:
    """读取 NSDDataSystem 数据库中的用户和已完成测试，供病例诊断/映射页使用。"""
    if not NSD_DATABASE_FILE.exists():
        return load_case_database()
    _, task_alias, task_channel = nsd_task_metadata()
    patients: dict[str, dict[str, Any]] = {}
    con = sqlite3.connect(f"file:{NSD_DATABASE_FILE}?mode=ro", uri=True)
    con.row_factory = sqlite3.Row
    try:
        cur = con.cursor()
        tables = {row[0] for row in cur.execute("select name from sqlite_master where type='table'")}
        if "user" in tables:
            for row in cur.execute('select user_id, name, birthday, gender_id, education, handedness_id, tag, medicalRecordNO from "user"'):
                user_id = str(row["user_id"] or row["medicalRecordNO"] or "").strip()
                if not user_id:
                    continue
                patients[user_id] = {
                    "id": user_id,
                    "name": str(row["name"] or user_id),
                    "age": "",
                    "sex": "男" if row["gender_id"] == 2 else "女" if row["gender_id"] == 1 else "",
                    "handedness": str(row["handedness_id"] or ""),
                    "education": str(row["education"] or ""),
                    "label": str(row["tag"] or ""),
                    "tests": [],
                }
        for table, task_name in task_alias.items():
            if table not in tables:
                continue
            rows = [dict(row) for row in cur.execute(f'select test_id, user_id, test_location, date from "{table}" order by date desc')]
            for index, row in enumerate(rows):
                user_id = str(row.get("user_id") or "unknown").strip()
                patient = patients.setdefault(user_id, {"id": user_id, "name": user_id, "age": "", "sex": "", "handedness": "", "education": "", "label": "", "tests": []})
                status = nsd_status_for_record(table, str(row.get("test_id") or ""), index)
                patient["tests"].append(
                    {
                        "test_id": table,
                        "test_name": task_name,
                        "test_time": str(row.get("date") or ""),
                        "file_path": str(row.get("test_location") or ""),
                        "channel": task_channel.get(table, "其他"),
                        "summary": status["status_label"],
                        **status,
                    }
                )
        for patient in patients.values():
            patient["tests"].sort(key=lambda item: item.get("test_time") or "", reverse=True)
    finally:
        con.close()
    ordered = sorted(patients.values(), key=lambda item: (len(item.get("tests", [])), item.get("id", "")), reverse=True)
    return {"patients": ordered}


def launch_nsd_data_system() -> dict[str, Any]:
    if not NSD_EXE_FILE.exists():
        raise FileNotFoundError(f"NSDDataSystem.exe not found: {NSD_EXE_FILE}")
    subprocess.Popen([str(NSD_EXE_FILE)], cwd=str(NSD_SYSTEM_DIR))
    return {"ok": True, "exe": str(NSD_EXE_FILE), "cwd": str(NSD_SYSTEM_DIR)}


def discover_target_columns() -> list[str]:
    """从已导入表格数据中发现可能代表疾病/分组/标签的目标列。"""
    preferred = ["diagnosis", "Diagnosis", "诊断", "disease", "疾病", "group", "分组", "label", "Label", "target", "status", "状态"]
    found: dict[str, int] = {}
    for file_path in iter_data_files():
        if infer_kind(file_path) != "tabular":
            continue
        try:
            df = load_csv(dataset_id_for(file_path))
        except Exception:
            continue
        for col in df.columns:
            name = str(col)
            lowered = name.lower()
            score = 0
            if name in preferred:
                score += 20 - preferred.index(name)
            if any(key in lowered for key in ["diagnosis", "disease", "group", "label", "target", "status"]):
                score += 8
            if any(key in name for key in ["诊断", "疾病", "分组", "状态"]):
                score += 8
            if df[col].nunique(dropna=True) <= max(12, len(df) // 4):
                score += 2
            if score:
                found[col] = max(found.get(col, 0), score)
    return [name for name, _ in sorted(found.items(), key=lambda item: (-item[1], item[0]))]


def count_target_values_for_channels(channels: list[str], target_column: str) -> int:
    """统计目标列在指定通道内能覆盖多少个按样本 ID 对齐的样本。"""
    samples: set[str] = set()
    for channel in channels:
        base = DATA_DIR / channel
        if not base.exists():
            continue
        for file_path in sorted(base.rglob("*")):
            if not file_path.is_file() or infer_kind(file_path) != "tabular":
                continue
            try:
                df = load_csv(dataset_id_for(file_path))
            except Exception:
                continue
            if target_column not in df.columns:
                continue
            sample_col = find_first_matching_column([str(c) for c in df.columns], SAMPLE_ID_HINTS)
            values = df.dropna(subset=[target_column])
            if values.empty:
                continue
            if sample_col and sample_col in values.columns:
                samples.update(values[sample_col].dropna().astype(str).tolist())
            else:
                samples.add(relative_data_path(file_path))
    return len(samples)


def discover_target_columns_for_channels(channels: list[str]) -> list[dict[str, Any]]:
    """按已选通道中的实际标注覆盖量排序目标列候选。"""
    names = discover_target_columns()
    enriched = []
    for name in names:
        lowered = name.lower()
        if any(token in lowered for token in ["subject", "participant", "patient", "sample", "session", "trial", "_id"]) or name in {"id", "ID", "Index", "Hand"}:
            continue
        labeled = count_target_values_for_channels(channels, name) if channels else 0
        enriched.append({"name": name, "labeled_sample_count": labeled})
    return sorted(enriched, key=lambda item: (-item["labeled_sample_count"], item["name"].lower()))


def summarize_numeric_series(series: pd.Series) -> dict[str, float]:
    """把单列原始数值压缩成一组可跨文件比较的基础特征。"""
    s = pd.to_numeric(series, errors="coerce").dropna()
    if s.empty:
        return {}
    return {
        "mean": float(s.mean()),
        "std": float(s.std() if len(s) > 1 else 0),
        "median": float(s.median()),
        "iqr": float(s.quantile(0.75) - s.quantile(0.25)),
        "min": float(s.min()),
        "max": float(s.max()),
    }


def find_first_matching_column(columns: list[str], hints: list[str]) -> str | None:
    """从列名中按常见命名习惯寻找目标列或样本 ID 列。"""
    lowered = {str(col).lower(): str(col) for col in columns}
    for hint in hints:
        if hint.lower() in lowered:
            return lowered[hint.lower()]
    for col in columns:
        name = str(col).lower()
        if any(hint.lower() in name for hint in hints):
            return str(col)
    return None


def encode_target_values(values: pd.Series) -> pd.Series:
    """把疾病分组目标列转成可评分的类别序列，同时保留原始分组含义。"""
    return values.dropna().astype(str)


def build_multichannel_feature_table(channels: list[str], target_column: str = "") -> tuple[pd.DataFrame, pd.Series | None, str]:
    """把多个通道的表格文件按受试者/样本 ID 对齐，生成联合探索特征表。"""
    if channels:
        target_candidates = discover_target_columns_for_channels(channels)
        best_target = target_candidates[0]["name"] if target_candidates and target_candidates[0]["labeled_sample_count"] > 0 else ""
        if not target_column or count_target_values_for_channels(channels, target_column) == 0:
            target_column = best_target or target_column
    rows_by_sample: dict[str, dict[str, Any]] = {}
    targets_by_sample: dict[str, str] = {}
    auto_target = target_column
    for channel in channels:
        base = DATA_DIR / channel
        if not base.exists():
            continue
        for file_path in sorted(base.rglob("*")):
            if not file_path.is_file() or infer_kind(file_path) != "tabular":
                continue
            try:
                df = load_csv(dataset_id_for(file_path))
            except Exception:
                continue
            if df.empty:
                continue
            sample_col = find_first_matching_column([str(c) for c in df.columns], SAMPLE_ID_HINTS)
            if not auto_target:
                auto_target = find_first_matching_column([str(c) for c in df.columns], TARGET_COLUMN_HINTS) or ""
            active_target = target_column or auto_target
            numeric = df.select_dtypes(include=np.number)
            excluded = {sample_col, active_target}
            if sample_col and sample_col in df.columns:
                groups = df.groupby(sample_col, dropna=False)
                iterator = groups
            else:
                iterator = [(file_path.stem, df)]
            for sample_id, group in iterator:
                key = str(sample_id)
                row = rows_by_sample.setdefault(key, {"sample_id": key})
                row.setdefault("source_files", set()).add(relative_data_path(file_path))
                for col in numeric.columns:
                    if col in excluded:
                        continue
                    for stat, value in summarize_numeric_series(group[col]).items():
                        row[f"{channel}::{col}::{stat}"] = value
                if active_target and active_target in group.columns:
                    mode = encode_target_values(group[active_target]).mode()
                    if not mode.empty:
                        targets_by_sample[key] = str(mode.iloc[0])
    rows = []
    targets = []
    for sample_id, row in rows_by_sample.items():
        clean = dict(row)
        clean["source_files"] = "；".join(sorted(clean.get("source_files", [])))
        rows.append(clean)
        targets.append(targets_by_sample.get(sample_id))
    feature_df = pd.DataFrame(rows).fillna(0)
    y = pd.Series(targets, index=feature_df.index) if any(v is not None for v in targets) else None
    return feature_df, y, auto_target


def score_feature_against_target(values: pd.Series, target: pd.Series | None) -> float:
    """计算候选特征与目标列的轻量关联得分；无目标时用变异度作为探索优先级。"""
    x = pd.to_numeric(values, errors="coerce").fillna(0)
    if target is not None:
        valid = target.notna()
        x = x.loc[valid].reset_index(drop=True)
        target = target.loc[valid].reset_index(drop=True)
    if len(x) < 2:
        return 0.0
    if target is None or target.nunique(dropna=True) < 2:
        mean = abs(float(x.mean())) + 1e-9
        return float(np.nan_to_num(x.std() / mean, nan=0.0, posinf=0.0, neginf=0.0))
    labels = target.astype(str)
    overall = x.mean()
    between = 0.0
    total = float(((x - overall) ** 2).sum()) + 1e-9
    for label in labels.unique():
        group = x[labels == label]
        between += len(group) * float((group.mean() - overall) ** 2)
    return float(np.nan_to_num(between / total, nan=0.0, posinf=0.0, neginf=0.0))


def split_feature_name(name: str) -> dict[str, str]:
    """解析通道特征名，便于前端和 LLM 解释时展示特征来源。"""
    parts = name.split("::")
    return {
        "channel": parts[0] if len(parts) > 0 else "",
        "source_feature": parts[1] if len(parts) > 1 else name,
        "stat": parts[2] if len(parts) > 2 else "",
    }


NON_SIGNAL_FEATURES = {"age", "sex", "edu", "education", "trial", "mmse", "moca"}


def is_signal_feature(name: str) -> bool:
    """过滤样本编号、人口学和量表总分等非任务信号字段。"""
    source = split_feature_name(name)["source_feature"].strip().lower()
    return source not in NON_SIGNAL_FEATURES and not source.endswith("_id")


FEATURE_KEYWORDS = {
    "语音": ["speech", "voice", "pause", "jitter", "speech_rate", "语音", "声音"],
    "肌电": ["emg", "tremor", "activation", "co_contraction", "肌电", "震颤"],
    "笔式": ["stroke", "pressure", "angle", "pause", "笔式", "书写", "压力"],
    "眼动": ["saccade", "fixation", "blink", "pursuit", "眼动", "注视", "扫视"],
}


def parse_goal_profile(goal: str, channels: list[str]) -> dict[str, Any]:
    """从探索目标中提取通道、特征关键词和排序意图，用来影响候选展示。"""
    text = (goal or "").lower()
    formula_template = extract_formula_template(goal or "")
    selected_channels = [ch for ch in channels if ch in (goal or "")]
    keyword_hits: list[str] = []
    for channel, words in FEATURE_KEYWORDS.items():
        if channel in selected_channels or channel in (goal or ""):
            keyword_hits.extend(words)
        else:
            keyword_hits.extend([word for word in words if word.lower() in text])
    free_tokens = [token.strip().lower() for token in text.replace("，", " ").replace("、", " ").replace(",", " ").split() if len(token.strip()) >= 2]
    keyword_hits.extend([token for token in free_tokens if token not in {"寻找", "探索", "分析", "相关", "疾病", "目标", "通道", "组合"}])
    intent = {
        "prefer_stability": "稳定" in goal,
        "prefer_combo": any(word in goal for word in ["组合", "联合", "协同", "跨通道"]),
        "compare_single": "单通道" in goal,
        "prefer_ratio": any(word in goal for word in ["比值", "比例", "相对", "ratio"]),
        "prefer_difference": any(word in goal for word in ["差值", "差异", "差分", "difference"]),
    }
    return {
        "goal": goal,
        "channels": selected_channels,
        "keywords": sorted(set(keyword_hits)),
        "intent": intent,
        "formula_template": formula_template,
    }


def feature_goal_match_score(feature_name: str, parsed: dict[str, str], goal_profile: dict[str, Any]) -> float:
    """计算候选特征与探索目标的匹配度，用于目标相关重排。"""
    if not goal_profile.get("goal"):
        return 0.0
    score = 0.0
    feature_lower = feature_name.lower()
    if parsed.get("channel") in goal_profile.get("channels", []):
        score += 0.28
    for keyword in goal_profile.get("keywords", []):
        if keyword and keyword.lower() in feature_lower:
            score += 0.12
    return min(score, 0.45)


def extract_formula_template(goal: str) -> str:
    """从自由文本中提取含 特征1/特征2/特征3 的组合公式模板。"""
    text = (
        goal.replace("（", "(")
        .replace("）", ")")
        .replace("＋", "+")
        .replace("－", "-")
        .replace("×", "*")
        .replace("÷", "/")
        .replace("，", ",")
        .replace("；", ";")
        .replace("。", ".")
    )
    if "特征" not in text:
        return ""
    chunks = re.split(r"[,;，；。！？\n\r]", text)
    candidates = []
    for chunk in chunks:
        if "特征" not in chunk or not any(op in chunk for op in "+-*/"):
            continue
        matches = re.findall(r"[特征\d+\-*/().\s_a-zA-Z]+", chunk)
        candidates.extend(match.strip() for match in matches if "特征" in match and any(op in match for op in "+-*/"))
    if not candidates:
        return ""
    formula = max(candidates, key=len)
    formula = re.sub(r"特征\s*(\d+)", r"f\1", formula)
    formula = re.sub(r"\s+", "", formula)
    return formula.strip(" ：:，,。;；")


def safe_eval_formula(node: ast.AST, values: dict[str, pd.Series]) -> pd.Series:
    """安全计算用户公式模板，只允许特征变量、四则运算和少量数值函数。"""
    if isinstance(node, ast.Expression):
        return safe_eval_formula(node.body, values)
    if isinstance(node, ast.Name):
        if node.id not in values:
            raise ValueError(f"Unknown formula variable: {node.id}")
        return values[node.id]
    if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
        index = next(iter(values.values())).index
        return pd.Series(float(node.value), index=index)
    if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.USub, ast.UAdd)):
        operand = safe_eval_formula(node.operand, values)
        return -operand if isinstance(node.op, ast.USub) else operand
    if isinstance(node, ast.BinOp):
        left = safe_eval_formula(node.left, values)
        right = safe_eval_formula(node.right, values)
        if isinstance(node.op, ast.Add):
            return left + right
        if isinstance(node.op, ast.Sub):
            return left - right
        if isinstance(node.op, ast.Mult):
            return left * right
        if isinstance(node.op, ast.Div):
            return left / (right.abs() + 1e-9)
    if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
        args = [safe_eval_formula(arg, values) for arg in node.args]
        fn = node.func.id
        if fn == "abs" and len(args) == 1:
            return args[0].abs()
        if fn == "log" and len(args) == 1:
            return np.log(args[0].abs() + 1e-9)
        if fn == "sqrt" and len(args) == 1:
            return np.sqrt(args[0].abs())
        if fn == "zscore" and len(args) == 1:
            return (args[0] - args[0].mean()) / (args[0].std() + 1e-9)
        if fn == "minmax" and len(args) == 1:
            return (args[0] - args[0].min()) / (args[0].max() - args[0].min() + 1e-9)
        if fn == "normdiff" and len(args) == 2:
            return (args[0] - args[1]) / (args[0].abs() + args[1].abs() + 1e-9)
        if fn == "mean" and len(args) >= 1:
            return sum(args) / len(args)
        if fn == "max" and len(args) >= 1:
            return pd.concat(args, axis=1).max(axis=1)
        if fn == "min" and len(args) >= 1:
            return pd.concat(args, axis=1).min(axis=1)
    raise ValueError("Unsupported formula expression.")


def extract_formula_variables(parsed_formula: ast.AST) -> list[str]:
    """提取安全公式中使用的 f1/f2/f3 变量名，保持编号顺序。"""
    return sorted(
        {
            node.id
            for node in ast.walk(parsed_formula)
            if isinstance(node, ast.Name) and node.id.startswith("f") and node.id[1:].isdigit()
        },
        key=lambda x: int(x[1:]),
    )


def formula_to_label(formula: str, variable_ids: list[str], chosen: list[dict[str, Any]]) -> str:
    """把公式变量替换成真实特征名，用于前端表格展示。"""
    label = formula
    for var, item in zip(variable_ids, chosen):
        label = label.replace(var, item["feature"])
    return label


def normalize_formula_template(formula: str) -> str:
    """清洗 LLM 或用户给出的公式，只保留受控 DSL 可解析的表达式。"""
    cleaned = (
        str(formula or "")
        .replace("（", "(")
        .replace("）", ")")
        .replace("＋", "+")
        .replace("－", "-")
        .replace("×", "*")
        .replace("÷", "/")
    )
    cleaned = re.sub(r"特征\s*(\d+)", r"f\1", cleaned)
    cleaned = re.sub(r"\s+", "", cleaned)
    return cleaned.strip(" ：:，,。;；")


def validate_formula_template(formula: str) -> bool:
    """验证公式是否只包含允许的变量、运算符和函数，避免执行任意 Python 表达式。"""
    try:
        parsed = ast.parse(formula, mode="eval")
    except SyntaxError:
        return False
    allowed_funcs = {"abs", "log", "sqrt", "zscore", "minmax", "normdiff", "mean", "max", "min"}
    allowed_nodes = (
        ast.Expression,
        ast.BinOp,
        ast.UnaryOp,
        ast.Call,
        ast.Name,
        ast.Load,
        ast.Constant,
        ast.Add,
        ast.Sub,
        ast.Mult,
        ast.Div,
        ast.USub,
        ast.UAdd,
    )
    for node in ast.walk(parsed):
        if not isinstance(node, allowed_nodes):
            return False
        if isinstance(node, ast.Name):
            if node.id in allowed_funcs:
                continue
            if not (node.id.startswith("f") and node.id[1:].isdigit()):
                return False
        if isinstance(node, ast.Call):
            if not isinstance(node.func, ast.Name) or node.func.id not in allowed_funcs:
                return False
    return bool(extract_formula_variables(parsed))


def build_local_goal_formula_plan(goal: str) -> list[dict[str, str]]:
    """在 LLM 不可用时，根据少量明确数学意图生成兜底公式。"""
    if not goal:
        return []
    formulas = []
    lowered = goal.lower()
    if any(word in goal for word in ["归一化差值", "标准化差值", "相对差值", "归一化差异"]):
        formulas.append({"name": "归一化差值", "formula": "normdiff(f1,f2)", "reason": "根据目标中的归一化差值意图生成。", "source": "local"})
    if any(word in goal for word in ["取对数", "对数", "log"]) or "log" in lowered:
        formulas.append({"name": "对数组合", "formula": "log(f1/f2)", "reason": "根据目标中的取对数意图生成。", "source": "local"})
    if any(word in goal for word in ["标准化", "zscore", "z-score"]):
        formulas.append({"name": "标准化差异", "formula": "zscore(f1)-zscore(f2)", "reason": "根据目标中的标准化意图生成。", "source": "local"})
    if any(word in goal for word in ["归一化", "minmax"]):
        formulas.append({"name": "MinMax归一化差异", "formula": "minmax(f1)-minmax(f2)", "reason": "根据目标中的归一化意图生成。", "source": "local"})
    valid = []
    seen = set()
    for item in formulas:
        formula = normalize_formula_template(item["formula"])
        if formula not in seen and validate_formula_template(formula):
            seen.add(formula)
            valid.append({**item, "formula": formula})
    return valid


def call_llm_for_formula_plan(goal: str, channels: list[str], scored: list[dict[str, Any]], target_column: str) -> dict[str, Any]:
    """让 LLM 将开放探索目标翻译成受控公式 DSL；失败时不影响本地计算。"""
    api_key = os.environ.get("LLM_API_KEY") or os.environ.get("OPENAI_API_KEY")
    if not api_key or not goal:
        return {"enabled": False, "formulas": [], "message": "未启用 LLM 公式规划。"}
    model = os.environ.get("LLM_MODEL") or os.environ.get("OPENAI_MODEL", "deepseek-v4-flash")
    base_url = (os.environ.get("LLM_BASE_URL") or os.environ.get("OPENAI_BASE_URL", "https://api.deepseek.com")).rstrip("/")
    timeout_seconds = int(os.environ.get("LLM_FORMULA_TIMEOUT_SECONDS", os.environ.get("LLM_TIMEOUT_SECONDS", "90")))
    feature_pool = [
        {
            "rank": index + 1,
            "placeholder": f"f{index + 1}",
            "feature": item["feature"],
            "channel": item.get("channel", ""),
            "score": round(float(item.get("score", 0)), 3),
            "stability": round(float(item.get("stability", 0)), 3),
        }
        for index, item in enumerate(scored[:10])
    ]
    prompt = {
        "role": "user",
        "content": (
            "请把用户的多通道特征探索目标翻译成可计算的安全公式 DSL，输出 JSON。"
            "只允许字段 formulas，每个元素包含 name、formula、reason。"
            "formula 只能使用 f1..f10、数字、+、-、*、/、括号，以及函数 abs(x)、log(x)、sqrt(x)、"
            "zscore(x)、minmax(x)、normdiff(a,b)、mean(a,b,...)、max(a,b,...)、min(a,b,...)。"
            "不要输出 Python 代码，不要使用未列出的函数。"
            "如果用户说归一化差值，优先使用 normdiff；如果说取对数，使用 log；如果说标准化，使用 zscore；"
            "如果用户没有明确公式，也可根据目标提出 1-4 个合理公式。\n"
            + json.dumps(
                {
                    "goal": goal,
                    "channels": channels,
                    "target_column": target_column,
                    "feature_pool": feature_pool,
                },
                ensure_ascii=False,
            )
        ),
    }
    req_body = json.dumps(
        {
            "model": model,
            "messages": [
                {"role": "system", "content": "你只负责把自然语言探索目标转成安全数学公式 DSL，并严格输出 JSON。"},
                prompt,
            ],
            "temperature": 0.2,
            "response_format": {"type": "json_object"},
        },
        ensure_ascii=False,
    ).encode("utf-8")
    req = urllib.request.Request(
        f"{base_url}/chat/completions",
        data=req_body,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout_seconds) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        content = data["choices"][0]["message"]["content"]
        parsed = json.loads(content)
        raw_formulas = parsed.get("formulas", [])
        formulas = []
        for item in raw_formulas:
            formula = normalize_formula_template(item.get("formula", ""))
            if validate_formula_template(formula):
                formulas.append(
                    {
                        "name": str(item.get("name") or "LLM公式"),
                        "formula": formula,
                        "reason": str(item.get("reason") or ""),
                        "source": "llm",
                    }
                )
        return {"enabled": True, "model": model, "formulas": formulas, "raw": parsed}
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, socket.timeout, KeyError, json.JSONDecodeError, ValueError) as exc:
        return {"enabled": False, "formulas": [], "message": f"LLM 公式规划失败，已回退到本地公式解析：{exc}"}


def build_free_formula_candidates(
    feature_df: pd.DataFrame,
    target: pd.Series | None,
    scored: list[dict[str, Any]],
    stability: dict[str, float],
    goal_profile: dict[str, Any],
) -> list[dict[str, Any]]:
    """把用户输入的公式模板代入目标相关特征，生成新的自由组合特征。"""
    formula_items = []
    if goal_profile.get("formula_template"):
        formula_items.append({"formula": goal_profile["formula_template"], "name": "自由公式", "source": "user"})
    formula_items.extend(goal_profile.get("llm_formula_templates", []))
    if not formula_items:
        return []
    pool = scored[: min(16, len(scored))]
    candidates = []
    seen_labels = set()

    for formula_item in formula_items:
        formula = normalize_formula_template(formula_item.get("formula", ""))
        if not validate_formula_template(formula):
            continue
        parsed_formula = ast.parse(formula, mode="eval")
        variable_ids = extract_formula_variables(parsed_formula)
        if not variable_ids:
            continue
        trials: list[list[dict[str, Any]]] = []
        max_trials = min(10, max(1, len(pool) - len(variable_ids) + 1))
        for offset in range(max_trials):
            trials.append(pool[offset : offset + len(variable_ids)])
        for primary in pool[:6]:
            others = [item for item in pool if item["feature"] != primary["feature"] and item["channel"] != primary["channel"]]
            if len(others) >= len(variable_ids) - 1:
                trials.append([primary] + others[: len(variable_ids) - 1])

        for chosen in trials:
            if len(chosen) < len(variable_ids):
                continue
            channels = [item["channel"] for item in chosen]
            if len(set(channels)) < min(2, len(channels)):
                continue
            values = {var: pd.to_numeric(feature_df[item["feature"]], errors="coerce").fillna(0) for var, item in zip(variable_ids, chosen)}
            try:
                series = safe_eval_formula(parsed_formula, values).replace([np.inf, -np.inf], np.nan).fillna(0)
            except ValueError:
                continue
            relevance = score_feature_against_target(series, target)
            combo_stability = round(float(np.mean([stability.get(item["feature"], 0.0) for item in chosen])), 3)
            goal_match = min(0.9, 0.45 + sum(item.get("goal_match", 0.0) for item in chosen) / max(len(chosen), 1))
            display = relevance + goal_match + 0.28
            if formula_item.get("source") == "llm":
                display += 0.12
            if goal_profile["intent"].get("prefer_stability"):
                display += 0.25 * combo_stability
            formula_label = formula_to_label(formula, variable_ids, chosen)
            if formula_label in seen_labels:
                continue
            seen_labels.add(formula_label)
            candidates.append(
                {
                    "feature": formula_label,
                    "operation": "LLM公式" if formula_item.get("source") == "llm" else ("目标公式" if formula_item.get("source") == "local" else "自由公式"),
                    "formula_template": formula,
                    "formula_name": formula_item.get("name", ""),
                    "formula_reason": formula_item.get("reason", ""),
                    "score": relevance,
                    "stability": combo_stability,
                    "goal_match": round(goal_match, 3),
                    "display_score": round(float(display), 3),
                    "channels": sorted(set(channels)),
                }
            )
    return candidates


def build_combination_candidates(
    feature_df: pd.DataFrame,
    target: pd.Series | None,
    left: str,
    right: str,
    stability: dict[str, float],
    goal_profile: dict[str, Any],
) -> list[dict[str, Any]]:
    """为两个单通道特征生成乘积、比值和差值三类跨通道组合候选。"""
    left_channel = left.split("::", 1)[0]
    right_channel = right.split("::", 1)[0]
    combo_match = feature_goal_match_score(left, split_feature_name(left), goal_profile) + feature_goal_match_score(right, split_feature_name(right), goal_profile)
    combo_match = min(combo_match, 0.55)
    combo_stability = round((stability.get(left, 0) + stability.get(right, 0)) / 2, 3)
    base_bonus = 0.12 if goal_profile["intent"].get("prefer_combo") else 0.0
    stability_bonus = 0.25 * combo_stability if goal_profile["intent"].get("prefer_stability") else 0.0
    operations = [
        ("乘积", "×", feature_df[left] * feature_df[right], 0.0),
        ("比值", "/", feature_df[left] / (feature_df[right].abs() + 1e-9), 0.18 if goal_profile["intent"].get("prefer_ratio") else 0.0),
        ("差值", "|-|", (feature_df[left] - feature_df[right]).abs(), 0.18 if goal_profile["intent"].get("prefer_difference") else 0.0),
    ]
    candidates = []
    for op_name, symbol, values, op_bonus in operations:
        relevance = score_feature_against_target(values, target)
        candidates.append(
            {
                "feature": f"{left} {symbol} {right}",
                "operation": op_name,
                "score": relevance,
                "stability": combo_stability,
                "goal_match": round(combo_match + op_bonus, 3),
                "display_score": round(float(relevance + combo_match + base_bonus + stability_bonus + op_bonus), 3),
                "channels": sorted({left_channel, right_channel}),
            }
        )
    return candidates


def bootstrap_feature_stability(feature_df: pd.DataFrame, target: pd.Series | None, feature_cols: list[str], seed: int = 42) -> dict[str, float]:
    """用轻量 bootstrap 重采样估计候选特征排名稳定性，样本少时自动降级。"""
    if target is not None:
        valid = target.notna()
        feature_df = feature_df.loc[valid].reset_index(drop=True)
        target = target.loc[valid].reset_index(drop=True)
    if len(feature_df) < 4 or not feature_cols:
        return {col: 0.0 for col in feature_cols}
    rng = np.random.default_rng(seed)
    rank_hits = {col: 0 for col in feature_cols}
    rounds = 40
    top_k = max(1, min(5, len(feature_cols) // 3))
    for _ in range(rounds):
        idx = rng.choice(feature_df.index.to_numpy(), size=len(feature_df), replace=True)
        sampled = feature_df.loc[idx].reset_index(drop=True)
        sampled_target = target.loc[idx].reset_index(drop=True) if target is not None else None
        scored = sorted(
            ((col, score_feature_against_target(sampled[col], sampled_target)) for col in feature_cols),
            key=lambda item: item[1],
            reverse=True,
        )
        for col, _ in scored[:top_k]:
            rank_hits[col] += 1
    return {col: round(rank_hits[col] / rounds, 3) for col in feature_cols}


def build_rule_based_multichannel_interpretation(
    goal: str,
    target_column: str,
    target: pd.Series | None,
    top: list[dict[str, Any]],
    combos: list[dict[str, Any]],
    channels: list[str],
) -> dict[str, Any]:
    """根据本轮真实排序结果生成探索闭环、数据相关假设和下一轮实验建议。"""
    top_channels = [split_feature_name(item["feature"])["channel"] for item in top[:6]]
    dominant_channels = sorted({ch for ch in top_channels if ch})
    combo_channels = sorted({ch for item in combos[:3] for ch in item.get("channels", [])})
    target_desc = target_column or "未选择目标列"
    if target is not None:
        counts = target.astype(str).value_counts().to_dict()
        target_desc = f"{target_column}；分组分布 {counts}"
    best_feature = top[0]["feature"] if top else "暂无候选特征"
    best_combo = combos[0]["feature"] if combos else "暂无跨通道组合"
    best_combo_op = combos[0].get("operation", "组合") if combos else "组合"
    formula_template = next((item.get("formula_template") for item in combos if item.get("operation") in {"自由公式", "目标公式", "LLM公式"}), "")
    loop = [
        f"候选生成：从 {len(channels)} 个通道按样本 ID 对齐，生成单通道统计特征。",
        f"疾病相关性评分：围绕 {target_desc} 计算每个候选对分组差异的解释强度。",
        f"跨通道组合搜索：优先组合高分但来源不同的通道；当前最高组合为 {best_combo}。",
        "稳定性验证：对样本进行 bootstrap 重采样，观察候选是否反复进入高分集合。",
        "LLM 解释：若配置 API Key，则把真实候选、得分、目标和探索目的交给 LLM 生成机制假设。",
    ]
    hypotheses = [
        f"当前最值得复核的单特征是 {best_feature}，建议回看它在不同疾病分组中的原始分布和异常值。",
        f"当前高贡献通道集中在 {'、'.join(dominant_channels) if dominant_channels else '暂无'}，下一轮应确认这些通道的采集质量和样本覆盖。",
        f"探索目标“{goal or '未填写'}”应进一步转成可检验问题：哪些通道组合在目标分组中稳定高于单通道特征。",
    ]
    if goal and formula_template:
        goal_response = f"已将探索目标转成可计算公式 {formula_template} 并实际生成新候选；当前最高{best_combo_op}组合为 {best_combo}，可与固定乘积、比值、差值组合一起比较。"
    elif goal:
        goal_response = f"已围绕“{goal}”重新计算候选；当前最高{best_combo_op}组合为 {best_combo}，可与其它组合形式对比复核。"
    else:
        goal_response = f"本轮未填写探索目标；系统按 {target_column or '自动目标列'} 的分组差异默认探索，当前最高组合为 {best_combo}。"
    goal_channels = [ch for ch in channels if ch in goal]
    focus_channels = goal_channels or combo_channels or dominant_channels or channels
    focus_text = "、".join(focus_channels)
    if "稳定" in goal:
        first_goal = f"围绕“{goal}”优先做稳定性复核：检查 {best_combo} 在 bootstrap、批次拆分和新增样本中是否保持高分。"
    elif "高于单通道" in goal or "单通道" in goal:
        first_goal = f"围绕“{goal}”比较单通道 Top 特征与 {best_combo} 的增益，确认联合特征是否真正带来额外解释力。"
    elif goal_channels:
        first_goal = f"围绕“{goal}”限制搜索在 {focus_text} 相关组合内，比较乘积、比例和差异三类联合特征。"
    elif goal:
        first_goal = f"围绕“{goal}”把当前最高组合 {best_combo} 转成可复核问题，并检查其 disease/control 分布差异。"
    else:
        first_goal = f"验证 {best_combo} 在不同批次或新增样本中是否仍高于单通道候选。"
    next_goals = [
        first_goal,
        f"围绕 {focus_text} 比较当前已计算的乘积、比值和差值组合，检查哪一类更稳定。",
        f"对 {best_feature} 绘制 disease/control 原始分布，确认高分是否由少数异常样本驱动。",
        f"补齐 {'、'.join(dominant_channels) if dominant_channels else '高贡献通道'} 的采集质量指标，评估缺失和噪声对排序的影响。",
    ]
    return {
        "exploration_loop": loop,
        "hypotheses": hypotheses,
        "goal_response": goal_response,
        "next_exploration_goals": next_goals,
    }


def build_visualization_plan(goal: str, top_features: list[dict[str, Any]], combos: list[dict[str, Any]], channels: list[str]) -> dict[str, Any]:
    """根据探索目标识别最适合的可视化类型，前端只渲染内置安全图形。"""
    text = (goal or "").lower()
    selected = []
    if any(k in text for k in ["相关", "相关性", "关联", "热力", "矩阵", "correlation", "heatmap"]):
        selected.append("heatmap")
    if any(k in text for k in ["趋势", "变化", "随时间", "时间", "trend", "curve", "折线"]):
        selected.append("trend")
    if any(k in text for k in ["贡献", "比重", "占比", "重要性", "权重", "贡献度", "pie", "饼图"]):
        selected.append("contribution")
    if any(k in text for k in ["通道", "跨通道", "组合", "联合", "互补", "网络", "mapping"]):
        selected.append("network")
    if any(k in text for k in ["稳定", "bootstrap", "鲁棒"]):
        selected.append("stability")
    defaults = ["heatmap", "contribution", "network", "stability"]
    for item in defaults:
        if item not in selected:
            selected.append(item)
    chart_meta = {
        "heatmap": {"title": "目标相关性热力图", "reason": "比较候选特征在目标相关、疾病相关和稳定性上的整体强弱。"},
        "trend": {"title": "特征变化趋势图", "reason": "用于观察候选特征在样本顺序或后续时间序列中的变化方向。"},
        "contribution": {"title": "通道贡献比重图", "reason": "汇总高分候选来自哪些通道，判断关键证据是否集中或互补。"},
        "network": {"title": "跨通道组合网络", "reason": "展示组合特征如何连接不同通道，突出联合信号来源。"},
        "stability": {"title": "稳定性-相关性散点图", "reason": "同时检查候选强度和 bootstrap 稳定性，避免只看单次高分。"},
    }
    return {
        "primary": selected[0],
        "charts": [{"type": item, **chart_meta[item]} for item in selected[:4]],
        "source": "local-rules",
        "available": list(chart_meta.values()),
        "data_scope": {
            "top_feature_count": len(top_features),
            "combo_count": len(combos),
            "channel_count": len(channels),
        },
    }


def call_llm_for_multichannel_explanation(payload: dict[str, Any]) -> dict[str, Any]:
    """可选调用 OpenAI-compatible LLM，为本轮真实多通道结果生成中文解释。"""
    api_key = os.environ.get("LLM_API_KEY") or os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return {"enabled": False, "message": "未配置 LLM_API_KEY 或 OPENAI_API_KEY，已使用本地规则解释。"}
    model = os.environ.get("LLM_MODEL") or os.environ.get("OPENAI_MODEL", "deepseek-v4-flash")
    base_url = (os.environ.get("LLM_BASE_URL") or os.environ.get("OPENAI_BASE_URL", "https://api.deepseek.com")).rstrip("/")
    timeout_seconds = int(os.environ.get("LLM_TIMEOUT_SECONDS", "90"))
    compact_payload = {
        "goal": payload.get("goal", ""),
        "channels": payload.get("channels", []),
        "target_column": payload.get("target_column", ""),
        "sample_count": payload.get("sample_count", 0),
        "labeled_sample_count": payload.get("labeled_sample_count", 0),
        "feature_count": payload.get("feature_count", 0),
        "target_distribution": payload.get("target_distribution", {}),
        "goal_profile": payload.get("goal_profile", {}),
        "visualization_plan": payload.get("visualization_plan", {}),
        "top_features": payload.get("top_features", [])[:6],
        "cross_channel_combinations": payload.get("cross_channel_combinations", [])[:6],
        "local_goal_response": payload.get("local_goal_response", ""),
        "local_next_exploration_goals": payload.get("local_next_exploration_goals", [])[:4],
    }
    prompt = {
        "role": "user",
        "content": (
            "你是疾病多通道数据分析顾问。请基于以下真实计算结果，用中文输出 JSON，字段包括 "
            "goal_response、next_exploration_goals、mechanism_hypotheses、validation_plan、next_round_questions、visualization_guidance。"
            "goal_response 需要直接回应用户输入的探索目标；next_exploration_goals 给出 3-5 个下一轮可执行探索目标。"
            "visualization_guidance 用 2-4 条说明本轮最应该查看哪些内置图形以及原因。"
            "不要做医学诊断，只提出可验证假设。\n"
            + json.dumps(compact_payload, ensure_ascii=False)[:6000]
        ),
    }
    req_body = json.dumps(
        {
            "model": model,
            "messages": [
                {"role": "system", "content": "你擅长多模态生物医学数据探索，但所有结论必须回到统计验证。"},
                prompt,
            ],
            "temperature": 0.25,
            "response_format": {"type": "json_object"},
        },
        ensure_ascii=False,
    ).encode("utf-8")
    req = urllib.request.Request(
        f"{base_url}/chat/completions",
        data=req_body,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout_seconds) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        content = data["choices"][0]["message"]["content"]
        try:
            parsed = json.loads(content)
        except json.JSONDecodeError:
            parsed = {
                "goal_response": content,
                "next_exploration_goals": [],
                "mechanism_hypotheses": [content],
                "validation_plan": [],
                "next_round_questions": [],
            }
        parsed["enabled"] = True
        parsed["model"] = model
        return parsed
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")[:300]
        if exc.code == 401:
            return {
                "enabled": False,
                "message": "LLM 调用失败：401 Unauthorized。当前 Key 已被读取，但与 LLM_BASE_URL/OPENAI_BASE_URL 或模型服务不匹配；请确认第三方服务地址和模型名。",
                "detail": detail,
            }
        return {"enabled": False, "message": f"LLM 调用失败：HTTP {exc.code}，已保留本地解释。", "detail": detail}
    except (TimeoutError, socket.timeout) as exc:
        return {
            "enabled": False,
            "message": f"LLM 响应超时，已保留本地解释。可稍后重试，或在 .env.local 中调大 LLM_TIMEOUT_SECONDS；当前为 {timeout_seconds} 秒。",
            "detail": str(exc),
        }
    except (urllib.error.URLError, KeyError, json.JSONDecodeError, ValueError) as exc:
        return {"enabled": False, "message": f"LLM 调用失败，已保留本地解释：{exc}"}


def multichannel_explore(channels: list[str], target_column: str = "", goal: str = "") -> dict[str, Any]:
    """执行多通道联合探索，输出候选关键特征、组合特征和下一轮验证路线。"""
    feature_df, target, active_target_column = build_multichannel_feature_table(channels, target_column)
    goal_profile = parse_goal_profile(goal, channels)
    feature_cols = [c for c in feature_df.columns if "::" in c]
    if target is not None:
        valid = target.notna()
        feature_cols = [c for c in feature_cols if pd.to_numeric(feature_df.loc[valid, c], errors="coerce").fillna(0).std() > 0]
    stability = bootstrap_feature_stability(feature_df, target, feature_cols)
    scored = []
    for col in feature_cols:
        parsed = split_feature_name(col)
        relevance = score_feature_against_target(feature_df[col], target)
        stability_score = stability.get(col, 0.0)
        goal_match = feature_goal_match_score(col, parsed, goal_profile)
        display_score = relevance + goal_match
        if goal_profile["intent"].get("prefer_stability"):
            display_score += 0.25 * stability_score
        scored.append(
            {
                "feature": col,
                "score": relevance,
                "stability": stability_score,
                "goal_match": round(goal_match, 3),
                "display_score": round(float(display_score), 3),
                **parsed,
            }
        )
    scored.sort(key=lambda item: item["display_score"], reverse=True)
    top = scored[:12]
    llm_formula_plan = call_llm_for_formula_plan(goal, channels, scored, active_target_column)
    local_formula_plan = build_local_goal_formula_plan(goal)
    planned_formulas = []
    seen_formulas = set()
    for item in [*llm_formula_plan.get("formulas", []), *local_formula_plan]:
        formula = normalize_formula_template(item.get("formula", ""))
        if formula and formula not in seen_formulas and validate_formula_template(formula):
            seen_formulas.add(formula)
            planned_formulas.append({**item, "formula": formula})
    goal_profile["llm_formula_templates"] = planned_formulas
    goal_profile["llm_formula_plan"] = {
        "enabled": llm_formula_plan.get("enabled", False),
        "message": llm_formula_plan.get("message", ""),
        "model": llm_formula_plan.get("model", ""),
        "formula_count": len(goal_profile["llm_formula_templates"]),
        "formulas": goal_profile["llm_formula_templates"],
    }

    combos = []
    top_cols = [item["feature"] for item in top[:8]]
    if goal_profile.get("channels"):
        focused = [item["feature"] for item in scored if item["channel"] in goal_profile["channels"]][:5]
        context = [item["feature"] for item in sorted(scored, key=lambda item: item["score"], reverse=True) if item["channel"] not in goal_profile["channels"]][:5]
        top_cols = list(dict.fromkeys(focused + context))
    for i, left in enumerate(top_cols):
        for right in top_cols[i + 1 :]:
            left_channel = left.split("::", 1)[0]
            right_channel = right.split("::", 1)[0]
            if left_channel == right_channel:
                continue
            combos.extend(build_combination_candidates(feature_df, target, left, right, stability, goal_profile))
    combos.extend(build_free_formula_candidates(feature_df, target, scored, stability, goal_profile))
    combos.sort(key=lambda item: item["display_score"], reverse=True)
    visualization_plan = build_visualization_plan(goal, top, combos[:8], channels)
    local_interpretation = build_rule_based_multichannel_interpretation(goal, active_target_column, target, top, combos[:8], channels)
    llm_payload = {
        "goal": goal,
        "channels": channels,
        "target_column": active_target_column,
        "sample_count": int(len(feature_df)),
        "labeled_sample_count": int(target.notna().sum()) if target is not None else 0,
        "feature_count": int(len(feature_cols)),
        "target_distribution": target.dropna().astype(str).value_counts().to_dict() if target is not None else {},
        "top_features": top[:8],
        "cross_channel_combinations": combos[:6],
        "visualization_plan": visualization_plan,
        "goal_profile": goal_profile,
        "local_hypotheses": local_interpretation["hypotheses"],
        "local_goal_response": local_interpretation["goal_response"],
        "local_next_exploration_goals": local_interpretation["next_exploration_goals"],
    }
    llm_interpretation = call_llm_for_multichannel_explanation(llm_payload)
    return {
        "goal": goal,
        "channels": channels,
        "target_column": active_target_column,
        "sample_count": int(len(feature_df)),
        "labeled_sample_count": int(target.notna().sum()) if target is not None else 0,
        "feature_count": int(len(feature_cols)),
        "target_available": target is not None,
        "top_features": top,
        "cross_channel_combinations": combos[:8],
        "visualization_plan": visualization_plan,
        "goal_profile": goal_profile,
        "target_distribution": target.dropna().astype(str).value_counts().to_dict() if target is not None else {},
        "exploration_loop": local_interpretation["exploration_loop"],
        "hypotheses": local_interpretation["hypotheses"],
        "goal_response": llm_interpretation.get("goal_response") if llm_interpretation.get("enabled") and llm_interpretation.get("goal_response") else local_interpretation["goal_response"],
        "next_exploration_goals": llm_interpretation.get("next_exploration_goals") if llm_interpretation.get("enabled") and llm_interpretation.get("next_exploration_goals") else local_interpretation["next_exploration_goals"],
        "llm_interpretation": llm_interpretation,
    }


def multichannel_feature_analysis(channels: list[str], target_column: str = "", goal: str = "") -> dict[str, Any]:
    """分析多通道基础特征的相关关系，帮助判断冗余特征和融合方向。"""
    feature_df, target, active_target_column = build_multichannel_feature_table(channels, target_column)
    raw_feature_cols = [c for c in feature_df.columns if "::" in c and is_signal_feature(c)]
    feature_groups: dict[str, list[tuple[str, str]]] = {}
    for col in raw_feature_cols:
        meta = split_feature_name(col)
        key = f"{meta['channel']}::{meta['source_feature']}"
        feature_groups.setdefault(key, []).append((meta["stat"], col))
    representative_cols: dict[str, str] = {}
    stat_priority = ["mean", "median", "max", "min", "std", "iqr"]
    for key, items in feature_groups.items():
        by_stat = {stat: col for stat, col in items}
        representative_cols[key] = next((by_stat[stat] for stat in stat_priority if stat in by_stat), items[0][1])
    numeric = pd.DataFrame({
        key: pd.to_numeric(feature_df[col], errors="coerce")
        for key, col in representative_cols.items()
    }).fillna(0)
    if numeric.empty:
        return {
            "goal": goal,
            "channels": channels,
            "target_column": active_target_column,
            "sample_count": int(len(feature_df)),
            "feature_count": 0,
            "target_distribution": {},
            "correlation_pairs": [],
            "low_correlation_pairs": [],
            "target_features": [],
            "suggestions": ["当前通道尚未形成可分析的数值特征。"],
        }
    corr = numeric.corr().replace([np.inf, -np.inf], np.nan).fillna(0)
    pairs = []
    low_pairs = []
    cols = list(numeric.columns)
    for i, left in enumerate(cols):
        for right in cols[i + 1:]:
            left_meta = split_feature_name(left)
            right_meta = split_feature_name(right)
            left_ch = left_meta["channel"]
            right_ch = right_meta["channel"]
            same_statistical_family = (
                left_ch == right_ch
                and left_meta["source_feature"] == right_meta["source_feature"]
                and left_meta["stat"] != right_meta["stat"]
            )
            if same_statistical_family:
                continue
            value = float(corr.loc[left, right])
            item = {"left": left, "right": right, "correlation": round(value, 3), "channels": sorted({left_ch, right_ch})}
            if abs(value) >= 0.82:
                pairs.append(item)
            elif left_ch != right_ch and abs(value) <= 0.18:
                low_pairs.append(item)
    pairs.sort(key=lambda item: abs(item["correlation"]), reverse=True)
    low_pairs.sort(key=lambda item: abs(item["correlation"]))
    target_features = []
    if target is not None:
        for col in cols:
            target_features.append({
                "feature": col,
                "score": round(score_feature_against_target(numeric[col], target), 3),
                "channel": col.split("::", 1)[0],
            })
        target_features.sort(key=lambda item: item["score"], reverse=True)
    suggestions = []
    if pairs:
        suggestions.append(f"优先检查 {len(pairs)} 对高相关特征，相关性最高的是 {pairs[0]['left']} 与 {pairs[0]['right']}。")
    if low_pairs:
        suggestions.append(f"低相关跨通道特征可作为融合候选，当前可从 {low_pairs[0]['left']} 和 {low_pairs[0]['right']} 开始。")
    if target_features:
        suggestions.append(f"目标相关性最高的基础特征是 {target_features[0]['feature']}，可作为后续组合的主特征。")
    return {
        "goal": goal,
        "channels": channels,
        "target_column": active_target_column,
        "sample_count": int(len(feature_df)),
        "feature_count": int(len(cols)),
        "target_distribution": target.dropna().astype(str).value_counts().to_dict() if target is not None else {},
        "correlation_pairs": pairs[:12],
        "low_correlation_pairs": low_pairs[:12],
        "target_features": target_features[:12],
        "suggestions": suggestions[:3],
    }


def train_model_from_frame(feature_df: pd.DataFrame, target: pd.Series | None, model: str, test_ratio: float = 0.25) -> ModelResult:
    """在已经对齐好的多通道特征表上训练分类模型。"""
    if target is None:
        raise ValueError("Target column not found.")
    valid = target.notna()
    X_df = feature_df.loc[valid, [c for c in feature_df.columns if "::" in c]].copy()
    y_raw = target.loc[valid].astype(str)
    X_df = X_df.apply(pd.to_numeric, errors="coerce").fillna(X_df.median(numeric_only=True)).fillna(0)
    labels = sorted(map(str, y_raw.unique()))
    label_map = {label: i for i, label in enumerate(labels)}
    y = y_raw.map(label_map).to_numpy(dtype=int)
    X = X_df.to_numpy(dtype=float)
    if len(np.unique(y)) < 2:
        raise ValueError("Target column must contain at least two classes.")
    if len(y) < 8:
        raise ValueError("Need at least 8 rows for a train/test split.")
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_ratio=max(0.1, min(0.45, float(test_ratio))))
    X_train, X_test = standardize(X_train, X_test)
    n_classes = len(labels)
    if model == "knn":
        pred = run_knn(X_train, X_test, y_train)
        name = "KNN"
    elif model == "gaussian_nb":
        pred = run_gaussian_nb(X_train, X_test, y_train, n_classes)
        name = "Gaussian Naive Bayes"
    elif model == "logistic_regression":
        pred = run_linear_margin_model(X_train, X_test, y_train, n_classes, mode="logistic")
        name = "Logistic Regression"
    else:
        pred = run_linear_margin_model(X_train, X_test, y_train, n_classes, mode="svm")
        name = "Linear SVM"
    acc = float((pred == y_test).mean())
    return ModelResult(
        name=name,
        accuracy=acc,
        confusion_matrix=confusion(y_test, pred, n_classes),
        labels=labels,
        details={
            "rows": int(len(y_raw)),
            "features_after_encoding": int(X.shape[1]),
            "test_rows": int(len(y_test)),
            "train_rows": int(len(y_train)),
            "test_ratio": float(test_ratio),
        },
    )


def multichannel_train(channels: list[str], target_column: str = "", model: str = "linear_svm", test_ratio: float = 0.25) -> dict[str, Any]:
    """基于多通道联合特征训练内置融合诊断模型。"""
    feature_df, target, active_target_column = build_multichannel_feature_table(channels, target_column)
    result = train_model_from_frame(feature_df, target, model, test_ratio)
    payload = result.__dict__
    payload["channels"] = channels
    payload["target_column"] = active_target_column
    return payload


def generate_demo_multichannel_data() -> dict[str, Any]:
    """调用本地演示数据脚本，生成可展示多通道疾病特征探索流程的 CSV。"""
    demo_channels = ["笔式", "眼动", "肌电", "语音"]
    expected = [DATA_DIR / channel / "2026-08-13-演示多通道疾病数据" / f"{channel}_demo_disease.csv" for channel in demo_channels]
    if all(path.exists() for path in expected):
        return {
            "message": "Demo data already exists.",
            "channels": demo_channels,
            "targets": discover_target_columns(),
            "dashboard": channel_dashboard(),
        }
    script = ROOT / "generate_multichannel_demo_data.py"
    completed = subprocess.run([sys.executable, str(script)], cwd=str(ROOT), capture_output=True, text=True, timeout=60)
    if completed.returncode != 0:
        raise RuntimeError(completed.stderr or completed.stdout or "Demo data generation failed.")
    return {
        "message": completed.stdout.strip(),
        "channels": demo_channels,
        "targets": discover_target_columns(),
        "dashboard": channel_dashboard(),
    }


def csv_features(dataset_id: str, methods: list[str]) -> dict[str, Any]:
    """对表格数据提取经典特征，并自动加载 custom_features 中的自定义特征函数。"""
    df = load_csv(dataset_id)
    numeric = df.select_dtypes(include=np.number)
    features: dict[str, Any] = {}
    if numeric.empty:
        return {"features": {}, "message": "No numeric columns found."}

    if "statistical" in methods:
        stats = {}
        for col in numeric.columns:
            s = numeric[col].dropna()
            stats[col] = {
                "mean": s.mean(),
                "std": s.std(),
                "min": s.min(),
                "max": s.max(),
                "median": s.median(),
                "iqr": s.quantile(0.75) - s.quantile(0.25),
                "skew": s.skew(),
                "kurtosis": s.kurtosis(),
            }
        features["statistical"] = stats

    if "time_window" in methods:
        windowed = {}
        for col in numeric.columns:
            s = numeric[col].interpolate(limit_direction="both").fillna(0)
            rolling = s.rolling(window=min(10, max(2, len(s) // 8)), min_periods=1)
            windowed[col] = {
                "rolling_mean_last": rolling.mean().iloc[-1],
                "rolling_std_last": rolling.std().fillna(0).iloc[-1],
                "diff_mean": s.diff().dropna().mean() if len(s) > 1 else 0,
                "diff_abs_mean": s.diff().abs().dropna().mean() if len(s) > 1 else 0,
            }
        features["time_window"] = windowed

    if "frequency" in methods:
        freq = {}
        for col in numeric.columns:
            arr = numeric[col].interpolate(limit_direction="both").fillna(0).to_numpy(dtype=float)
            spectrum = np.abs(np.fft.rfft(arr - arr.mean()))
            dominant = int(np.argmax(spectrum[1:]) + 1) if len(spectrum) > 1 else 0
            energy = float(np.sum(spectrum[1:] ** 2)) if len(spectrum) > 1 else 0
            freq[col] = {"dominant_frequency_bin": dominant, "spectral_energy": energy}
        features["frequency"] = freq

    if "correlation" in methods:
        features["correlation"] = numeric.corr().round(5).to_dict()

    if "custom" in methods:
        custom = {}
        for module_path in CUSTOM_FEATURE_DIR.glob("*.py"):
            spec = importlib.util.spec_from_file_location(module_path.stem, module_path)
            if spec and spec.loader:
                module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(module)
                if hasattr(module, "extract_features"):
                    custom[module_path.stem] = module.extract_features(df)
        features["custom"] = custom

    return {"features": features}


def image_features(dataset_id: str) -> dict[str, Any]:
    """对图像提取基础可解释特征，作为传统图像分类/质量分析的输入。"""
    path = dataset_path(dataset_id)
    with Image.open(path) as img:
        rgb = img.convert("RGB")
        gray = img.convert("L")
        stat = ImageStat.Stat(rgb)
        edges = gray.filter(ImageFilter.FIND_EDGES)
        edge_stat = ImageStat.Stat(edges)
        hist = gray.histogram()
        total = sum(hist) or 1
        entropy = -sum((h / total) * math.log2(h / total) for h in hist if h)
        return {
            "features": {
                "image_basic": {
                    "width": img.width,
                    "height": img.height,
                    "aspect_ratio": img.width / max(img.height, 1),
                    "mean_rgb": stat.mean,
                    "std_rgb": stat.stddev,
                    "brightness_mean": ImageStat.Stat(gray).mean[0],
                    "edge_intensity_mean": edge_stat.mean[0],
                    "gray_entropy": entropy,
                }
            }
        }


def recommend_methods(summary: dict[str, Any], goal: str = "") -> dict[str, Any]:
    """根据数据类型、列结构和用户目标描述，给出分析方法与模型选择建议。"""
    kind = summary.get("kind")
    goal_lower = goal.lower()
    recs = []
    if kind == "tabular":
        numeric_count = len(summary.get("numeric_columns", []))
        cat_count = len(summary.get("categorical_columns", []))
        recs.extend(
            [
                {"stage": "特征提取", "method": "统计特征", "reason": "适合快速刻画每列原始信号的集中趋势、波动和异常范围。"},
                {"stage": "特征提取", "method": "相关性矩阵", "reason": "用于发现冗余特征和潜在的线性关系。"},
            ]
        )
        if numeric_count:
            recs.append({"stage": "特征提取", "method": "频域特征/FFT", "reason": "当行顺序代表时间或采样序列时，可捕捉周期性。"})
            recs.append({"stage": "分析", "method": "缺失值、异常值、分布分析", "reason": "建模前先判断数据质量和尺度差异。"})
        if cat_count:
            recs.append({"stage": "预处理", "method": "类别编码", "reason": "分类模型训练前需要将文本类别转成数值标签。"})
        if "class" in goal_lower or "分类" in goal or "识别" in goal:
            recs.extend(
                [
                    {"stage": "模型", "method": "Linear SVM", "reason": "高维数值特征上的稳健基线，适合二分类/多分类。"},
                    {"stage": "模型", "method": "KNN", "reason": "直观、无需复杂训练，适合小样本原型验证。"},
                    {"stage": "模型", "method": "Gaussian Naive Bayes", "reason": "训练快，可作为概率型轻量基线。"},
                ]
            )
        else:
            recs.append({"stage": "交互分析", "method": "目标描述驱动推荐", "reason": "输入分析目的后，可进一步收窄到分类、聚类、回归或异常检测。"})
    elif kind == "image":
        recs.extend(
            [
                {"stage": "特征提取", "method": "颜色/亮度/纹理/边缘特征", "reason": "无需深度模型即可建立可解释图像特征。"},
                {"stage": "模型", "method": "传统特征 + SVM/KNN", "reason": "适合作为图像分类的经典基线。"},
            ]
        )
    elif kind == "video":
        recs.extend(
            [
                {"stage": "特征提取", "method": "抽帧 + 图像特征聚合", "reason": "把视频转成帧级特征后，可计算均值、变化率和关键帧统计。"},
                {"stage": "分析", "method": "时序变化分析", "reason": "用于定位状态变化、运动强度或事件片段。"},
            ]
        )
    return {"recommendations": recs, "goal": goal}


@dataclass
class ModelResult:
    name: str
    accuracy: float
    confusion_matrix: list[list[int]]
    labels: list[str]
    details: dict[str, Any]


def train_test_split(X: np.ndarray, y: np.ndarray, test_ratio: float = 0.25, seed: int = 7):
    """对样本做可复现的训练/测试拆分，供内置模型快速评估。"""
    rng = np.random.default_rng(seed)
    idx = rng.permutation(len(y))
    cut = max(1, int(len(y) * (1 - test_ratio)))
    return X[idx[:cut]], X[idx[cut:]], y[idx[:cut]], y[idx[cut:]]


def standardize(train: np.ndarray, test: np.ndarray):
    """用训练集均值和标准差做标准化，避免测试集信息泄露。"""
    mean = train.mean(axis=0)
    std = train.std(axis=0)
    std[std == 0] = 1
    return (train - mean) / std, (test - mean) / std


def confusion(y_true: np.ndarray, y_pred: np.ndarray, n: int) -> list[list[int]]:
    """生成分类任务的混淆矩阵。"""
    mat = np.zeros((n, n), dtype=int)
    for a, b in zip(y_true, y_pred):
        mat[int(a), int(b)] += 1
    return mat.tolist()


def run_knn(X_train, X_test, y_train, k=5):
    """运行 KNN 基线分类器，适合小样本原型验证。"""
    preds = []
    k = min(k, len(y_train))
    for row in X_test:
        dist = np.sqrt(((X_train - row) ** 2).sum(axis=1))
        labels = y_train[np.argsort(dist)[:k]]
        preds.append(np.bincount(labels).argmax())
    return np.array(preds)


def run_gaussian_nb(X_train, X_test, y_train, n_classes):
    """运行 Gaussian Naive Bayes，作为快速概率分类基线。"""
    means, vars_, priors = [], [], []
    for c in range(n_classes):
        subset = X_train[y_train == c]
        means.append(subset.mean(axis=0))
        vars_.append(subset.var(axis=0) + 1e-9)
        priors.append(len(subset) / len(y_train))
    scores = []
    for c in range(n_classes):
        log_prob = -0.5 * np.sum(np.log(2 * np.pi * vars_[c]) + ((X_test - means[c]) ** 2) / vars_[c], axis=1)
        scores.append(log_prob + math.log(priors[c] + 1e-9))
    return np.argmax(np.vstack(scores).T, axis=1)


def run_linear_margin_model(X_train, X_test, y_train, n_classes, mode="svm", epochs=250, lr=0.03):
    """用 NumPy 实现轻量线性分类器，支持 SVM hinge loss 和 softmax logistic loss。"""
    Y = np.eye(n_classes)[y_train]
    if mode == "svm":
        Y = np.where(Y == 1, 1, -1)
    W = np.zeros((X_train.shape[1], n_classes))
    b = np.zeros(n_classes)
    for _ in range(epochs):
        scores = X_train @ W + b
        if mode == "svm":
            margins = 1 - Y * scores
            active = margins > 0
            grad_w = -(X_train.T @ (Y * active)) / len(X_train) + 0.001 * W
            grad_b = -(Y * active).mean(axis=0)
        else:
            exps = np.exp(scores - scores.max(axis=1, keepdims=True))
            probs = exps / exps.sum(axis=1, keepdims=True)
            grad_w = X_train.T @ (probs - Y) / len(X_train)
            grad_b = (probs - Y).mean(axis=0)
        W -= lr * grad_w
        b -= lr * grad_b
    return np.argmax(X_test @ W + b, axis=1)


def train_model(dataset_id: str, target: str, model: str) -> ModelResult:
    """读取表格数据，完成编码、标准化、模型训练和测试集评估。"""
    df = load_csv(dataset_id)
    if target not in df.columns:
        raise ValueError(f"Target column not found: {target}")
    df = df.dropna(subset=[target]).copy()
    X_df = df.drop(columns=[target])
    X_df = pd.get_dummies(X_df, dummy_na=True)
    X_df = X_df.apply(pd.to_numeric, errors="coerce").fillna(X_df.median(numeric_only=True)).fillna(0)
    labels = sorted(map(str, df[target].astype(str).unique()))
    label_map = {label: i for i, label in enumerate(labels)}
    y = df[target].astype(str).map(label_map).to_numpy(dtype=int)
    X = X_df.to_numpy(dtype=float)
    if len(np.unique(y)) < 2:
        raise ValueError("Target column must contain at least two classes.")
    if len(y) < 8:
        raise ValueError("Need at least 8 rows for a train/test split.")
    X_train, X_test, y_train, y_test = train_test_split(X, y)
    X_train, X_test = standardize(X_train, X_test)
    n_classes = len(labels)
    if model == "knn":
        pred = run_knn(X_train, X_test, y_train)
        name = "KNN"
    elif model == "gaussian_nb":
        pred = run_gaussian_nb(X_train, X_test, y_train, n_classes)
        name = "Gaussian Naive Bayes"
    elif model == "logistic_regression":
        pred = run_linear_margin_model(X_train, X_test, y_train, n_classes, mode="logistic")
        name = "Logistic Regression"
    else:
        pred = run_linear_margin_model(X_train, X_test, y_train, n_classes, mode="svm")
        name = "Linear SVM"
    acc = float((pred == y_test).mean())
    return ModelResult(
        name=name,
        accuracy=acc,
        confusion_matrix=confusion(y_test, pred, n_classes),
        labels=labels,
        details={"rows": len(df), "features_after_encoding": X.shape[1], "test_rows": len(y_test)},
    )
