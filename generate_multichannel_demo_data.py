from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd


ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "Data"
BATCH = "2026-08-13-演示多通道疾病数据"
CHANNELS = ["笔式", "眼动", "肌电", "语音"]


def make_subjects(n: int = 72) -> pd.DataFrame:
    """生成带疾病分组的受试者索引，供所有通道按 subject_id 对齐。"""
    rng = np.random.default_rng(20260813)
    diagnosis = np.array(["control"] * (n // 2) + ["disease"] * (n - n // 2))
    rng.shuffle(diagnosis)
    severity = np.where(diagnosis == "disease", rng.normal(1.4, 0.35, n), rng.normal(0.25, 0.2, n))
    return pd.DataFrame(
        {
            "subject_id": [f"S{i:03d}" for i in range(1, n + 1)],
            "diagnosis": diagnosis,
            "severity_index": np.clip(severity, 0, None),
        }
    )


def channel_rows(subjects: pd.DataFrame, channel: str) -> pd.DataFrame:
    """为指定通道生成多次 trial 原始记录，保留可被工具箱聚合的原始列。"""
    rng = np.random.default_rng(abs(hash(channel)) % (2**32))
    rows = []
    for _, item in subjects.iterrows():
        is_disease = item["diagnosis"] == "disease"
        sev = float(item["severity_index"])
        for trial in range(1, 7):
            noise = rng.normal(0, 0.08)
            if channel == "笔式":
                rows.append(
                    {
                        "subject_id": item["subject_id"],
                        "diagnosis": item["diagnosis"],
                        "trial": trial,
                        "stroke_speed": rng.normal(1.9 - 0.34 * sev, 0.12),
                        "pressure_variability": rng.normal(0.16 + 0.26 * sev, 0.05),
                        "angle_jitter": rng.normal(3.8 + 3.1 * sev, 0.7),
                        "micro_pause_rate": rng.normal(0.08 + 0.18 * sev + noise, 0.04),
                    }
                )
            elif channel == "眼动":
                rows.append(
                    {
                        "subject_id": item["subject_id"],
                        "diagnosis": item["diagnosis"],
                        "trial": trial,
                        "saccade_latency": rng.normal(180 + 42 * sev, 14),
                        "fixation_instability": rng.normal(0.12 + 0.23 * sev, 0.05),
                        "blink_rate": rng.normal(12 + 2.7 * sev, 1.1),
                        "pursuit_gain": rng.normal(0.94 - 0.12 * sev, 0.04),
                    }
                )
            elif channel == "肌电":
                rows.append(
                    {
                        "subject_id": item["subject_id"],
                        "diagnosis": item["diagnosis"],
                        "trial": trial,
                        "emg_rms": rng.normal(0.48 + 0.2 * sev, 0.06),
                        "tremor_band_power": rng.normal(0.18 + 0.38 * sev, 0.08),
                        "activation_delay": rng.normal(80 + 24 * sev, 8),
                        "co_contraction": rng.normal(0.22 + 0.18 * sev, 0.06),
                    }
                )
            else:
                rows.append(
                    {
                        "subject_id": item["subject_id"],
                        "diagnosis": item["diagnosis"],
                        "trial": trial,
                        "speech_rate": rng.normal(4.6 - 0.45 * sev, 0.18),
                        "pause_ratio": rng.normal(0.08 + 0.16 * sev, 0.04),
                        "jitter_percent": rng.normal(0.55 + 0.38 * sev, 0.1),
                        "voice_intensity_var": rng.normal(2.1 + 0.9 * sev, 0.25),
                    }
                )
    df = pd.DataFrame(rows)
    numeric_cols = [c for c in df.columns if c not in {"subject_id", "diagnosis"}]
    df[numeric_cols] = df[numeric_cols].round(4)
    return df


def main() -> None:
    """写入一批可直接演示多通道联合关键特征探索的 CSV 数据。"""
    subjects = make_subjects()
    for channel in CHANNELS:
        out_dir = DATA_DIR / channel / BATCH
        out_dir.mkdir(parents=True, exist_ok=True)
        channel_rows(subjects, channel).to_csv(out_dir / f"{channel}_demo_disease.csv", index=False, encoding="utf-8-sig")
    print(f"Generated demo data under {DATA_DIR}")


if __name__ == "__main__":
    main()
