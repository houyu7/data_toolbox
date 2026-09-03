import numpy as np


def extract_features(df):
    numeric = df.select_dtypes(include=np.number)
    if numeric.empty:
        return {}
    return {
        "row_energy_mean": float((numeric.fillna(0) ** 2).sum(axis=1).mean()),
        "numeric_column_count": int(len(numeric.columns)),
    }
