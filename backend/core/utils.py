import numpy as np
import pandas as pd
from typing import List, Dict

def iso_times_from_coord(time_coord) -> List[str]:
    vals = time_coord.values
    out = []
    if vals.shape == ():
        vals_list = [vals]
    else:
        vals_list = list(vals) if len(vals.shape) > 0 else [vals]
    for t in vals_list:
        if isinstance(t, (np.datetime64, pd.Timestamp)):
            out.append(pd.to_datetime(t).strftime("%Y-%m-%d"))
        elif hasattr(t, 'year') and hasattr(t, 'month') and hasattr(t, 'day'):
            out.append(f"{t.year:04d}-{t.month:02d}-{t.day:02d}")
        else:
            out.append(str(t))
    return out

def data_min_max(da) -> Dict[str, float]:
    try:
        return {"min": float(da.min().values), "max": float(da.max().values)}
    except Exception:
        return {"min": 0.0, "max": 0.0}

def downsample_grid(lats, lons, vals, step: int = 1):
    return lats[::step], lons[::step], vals[::step, ::step]
