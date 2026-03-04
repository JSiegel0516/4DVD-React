from typing import Optional, List, Dict
import os
import json
from fastapi import FastAPI, Query, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import xarray as xr
import pandas as pd
import numpy as np
import cftime
from scipy.stats import skew, kurtosis
from contextlib import contextmanager
from pathlib import Path

# --- Config ---
ROOT_DIR = r"C:\Users\jsieg\Documents\4dvd-clone\backend\dataset"

# --- Encoding Fix for Windows ---
import io
import sys
if sys.platform == "win32":
    import os
    os.environ["PYTHONIOENCODING"] = "utf-8"
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# --- Cache ---
DATASET_INFO_CACHE = {}
DATASET_DATES_CACHE = {}
TIMESERIES_PLOT_CACHE = {}  # Cache timeseries plots
TIMESERIES_DATA_CACHE = {}  # Cache raw timeseries data

# --- Request deduplication ---
import asyncio
REQUEST_LOCKS = {}  # Prevent duplicate concurrent requests
LOCK_TIMEOUT = 30  # seconds

# --- Custom JSON Encoder for NaN ---
class NumpyEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (np.floating, float)) and np.isnan(obj):
            return None
        if isinstance(obj, np.integer):
            return int(obj)
        if isinstance(obj, np.floating):
            return float(obj)
        return super().default(obj)

# --- Utils ---
@contextmanager
def open_dataset(path: str):
    """Open a dataset (zarr store only) with context manager to ensure cleanup."""
    path_str = str(path)
    is_zarr = path_str.endswith('.zarr')

    if not is_zarr:
        raise ValueError(f"Only zarr stores are supported (got: {path_str})")

    # Attempt consolidated first for performance; fall back if missing
    try:
        ds = xr.open_zarr(path_str, consolidated=True)
    except Exception:
        ds = xr.open_zarr(path_str, consolidated=False)

    try:
        yield ds
    finally:
        ds.close()

def iso_times_from_coord(time_coord) -> list[str]:
    """Convert xarray time coordinates to ISO strings."""
    try:
        vals = time_coord.values
        out = []
        vals_list = [vals] if vals.shape == () else list(vals)
        for t in vals_list:
            if isinstance(t, (np.datetime64, pd.Timestamp)):
                out.append(pd.to_datetime(t).strftime("%Y-%m-%d"))
            elif hasattr(t, 'year') and hasattr(t, 'month') and hasattr(t, 'day'):
                out.append(f"{t.year:04d}-{t.month:02d}-{t.day:02d}")
            else:
                out.append(str(t))
        return out
    except Exception as e:
        print(f"Error in iso_times_from_coord: {str(e)}")
        return []

def guess_cmap_name(varname: str, units: str) -> str:
    """Suggest a colormap based on variable name and units.
    
    Returns colormap names compatible with colorMaps.json structure.
    Format: 'Category|Subcategory|Name' or simpler names for common cases.
    """
    name = varname.lower()
    u = (units or "").lower()
    
    # Anomaly/difference data - use diverging colormaps
    if any(k in name for k in ["anom", "anomaly", "difference", "delta"]):
        return "Color Brewer 2.0|Diverging|Zero Centered|11-class RdBu"
    
    # Temperature data - use warm colormaps
    if any(k in u for k in ["k", "°c", "degc", "kelvin", "celsius", "temperature"]):
        return "Matlab|Hot"
    
    # Precipitation - use sequential colormap
    if any(k in name for k in ["precip", "rain", "snow", "snod", "pr"]):
        return "Color Brewer 2.0|Sequential|Multi-Hue|9-class YlGnBu"
    
    # Wind/speed - use plasma-like colormap
    if any(k in name for k in ["wind", "speed", "velocity"]):
        return "Matlab|Jet"
    
    # Default to Jet (similar to viridis in appearance)
    return "Matlab|Jet"

def guess_units(varname: str) -> str:
    """Guess units based on variable name if not provided in dataset."""
    name = varname.lower()
    if any(k in name for k in ["precip", "rain", "snow", "snod", "pr"]):
        return "mm/day"
    if any(k in name for k in ["temp", "air", "temperature"]):
        return "K"
    if any(k in name for k in ["wind", "speed"]):
        return "m/s"
    return "unknown"

def choose_best_variable(ds: xr.Dataset, fallback: str = "precip") -> str:
    """Pick the most appropriate variable in the dataset."""
    variables = list(ds.data_vars)
    filtered = [v for v in variables if "bnds" not in v.lower()]
    if not filtered:
        return variables[0]
    if fallback in filtered:
        return fallback
    for v in filtered:
        name = v.lower()
        units = (ds[v].attrs.get("units") or "").lower()
        if any(k in name for k in ["anom", "anomaly", "difference"]):
            return v
        if any(k in units for k in ["k", "°c", "degc", "kelvin", "celsius", "temperature"]):
            return v
        if any(k in name for k in ["precip", "rain", "snow", "snod", "pr"]):
            return v
        if any(k in name for k in ["wind", "speed"]):
            return v
    return filtered[0]

def open_dataset_flexible(path: str, variable_of_interest: Optional[str] = None):
    """Open a dataset (zarr), pick a variable, and detect multi-level structure."""
    try:
        with open_dataset(path) as ds:
            if "time" in ds.coords:
                time_vals = ds["time"].values
                if isinstance(time_vals[0], (cftime.DatetimeNoLeap, cftime.DatetimeGregorian)):
                    pass
                elif pd.api.types.is_numeric_dtype(time_vals):
                    units = ds["time"].attrs.get("units", "days since 1800-01-01")
                    ref_date = units.split("since")[-1].strip()
                    ds["time"] = pd.to_datetime(ref_date) + pd.to_timedelta(time_vals, unit="D")
            if variable_of_interest and variable_of_interest not in ds.data_vars:
                raise ValueError(f"Variable {variable_of_interest} not found in dataset. Available variables: {list(ds.data_vars)}")
            chosen_var = variable_of_interest if variable_of_interest in ds.data_vars else choose_best_variable(ds)
            print(f"Chosen variable: {chosen_var}")
            da = ds[chosen_var]
            units = da.attrs.get("units", guess_units(chosen_var))
            multilevel = False
            levels = None
            level_units = ""
            if "level" in da.dims or "plev" in da.dims:
                multilevel = True
                level_dim = "level" if "level" in da.dims else "plev"
                levels = da[level_dim].values
                level_units = ds[level_dim].attrs.get("units", "mb")
            return ds, chosen_var, multilevel, levels, units, level_units
    except Exception as e:
        print(f"Error in open_dataset_flexible: {str(e)}")
        raise

def is_multilevel(da: xr.DataArray) -> bool:
    """Detect if a DataArray has vertical levels (pressure or height)."""
    return "level" in da.dims or "plev" in da.dims

def select_time_safe(da, date_str: str):
    """Select a time slice safely for both cftime and pandas time coords."""
    try:
        target = pd.to_datetime(date_str)
        time_vals = da["time"].values
        if isinstance(time_vals[0], cftime.DatetimeGregorian):
            target = cftime.DatetimeGregorian(target.year, target.month, target.day)
        return da.sel(time=target, method="nearest")
    except Exception as e:
        print(f"⚠️ Fallback to first timestep due to: {str(e)}")
        return da.isel(time=0)

def compute_statistics(da: xr.DataArray, level_dim: str = "level") -> pd.DataFrame:
    """Compute descriptive statistics for a DataArray (per level if multilevel)."""
    stats = {}
    if level_dim in da.dims:
        levels = da[level_dim].values
        for lev in levels:
            arr = da.sel({level_dim: lev}).values.flatten()
            arr = arr[np.isfinite(arr)]
            if len(arr) == 0:
                print(f"No valid data for level {lev}")
                stats[lev] = {
                    "Min": None,
                    "25%": None,
                    "50%": None,
                    "Mean": None,
                    "75%": None,
                    "Max": None,
                    "Std": None,
                    "Var": None,
                    "Skewness": None,
                    "Kurtosis": None,
                }
                continue
            stats[lev] = {
                "Min": np.min(arr) if len(arr) > 0 else None,
                "25%": np.percentile(arr, 25) if len(arr) > 0 else None,
                "50%": np.median(arr) if len(arr) > 0 else None,
                "Mean": np.mean(arr) if len(arr) > 0 else None,
                "75%": np.percentile(arr, 75) if len(arr) > 0 else None,
                "Max": np.max(arr) if len(arr) > 0 else None,
                "Std": np.std(arr, ddof=1) if len(arr) > 0 else None,
                "Var": np.var(arr, ddof=1) if len(arr) > 0 else None,
                "Skewness": skew(arr, bias=False) if len(arr) > 0 else None,
                "Kurtosis": kurtosis(arr, bias=False) if len(arr) > 0 else None,
            }
        df = pd.DataFrame(stats).T
        df.index.name = "Level"
        return df
    else:
        arr = da.values.flatten()
        arr = arr[np.isfinite(arr)]
        if len(arr) == 0:
            print(f"No valid data for single level")
            stats_single = {
                "Min": None,
                "25%": None,
                "50%": None,
                "Mean": None,
                "75%": None,
                "Max": None,
                "Std": None,
                "Var": None,
                "Skewness": None,
                "Kurtosis": None,
            }
        else:
            stats_single = {
                "Min": np.min(arr),
                "25%": np.percentile(arr, 25),
                "50%": np.median(arr),
                "Mean": np.mean(arr),
                "75%": np.percentile(arr, 75),
                "Max": np.max(arr),
                "Std": np.std(arr, ddof=1),
                "Var": np.var(arr, ddof=1),
                "Skewness": skew(arr, bias=False),
                "Kurtosis": kurtosis(arr, bias=False),
            }
        return pd.DataFrame([stats_single], index=["Single Level"])

def compute_point_stats(da: xr.DataArray, lat: float, lon: float, level: Optional[float] = None) -> pd.DataFrame:
    """Compute point statistics over time at a specific lat/lon (and level)."""
    point = da.sel(lat=lat, lon=lon, method="nearest")
    if is_multilevel(da):
        if level is None:
            level = float(point["level"].values[0])
        point = point.sel(level=level, method="nearest")
    times = iso_times_from_coord(point["time"])
    vals = point.values.astype(float)
    mask = np.isfinite(vals)
    times = np.array(times)[mask]
    vals = vals[mask]
    mean_val = np.mean(vals)
    std_val = np.std(vals, ddof=0)
    df = pd.DataFrame({
        "Time": times,
        "Value": vals,
    })
    df["Mean"] = mean_val
    df["Std"] = std_val
    return df.set_index("Time")

def compute_point_statistics(da: xr.DataArray, lat: float, lon: float, level: Optional[float] = None, date: Optional[str] = None) -> pd.DataFrame:
    """Compute descriptive statistics for a single point (lat, lon, level)."""
    point = da.sel(lat=lat, lon=lon, method="nearest")
    if is_multilevel(da):
        if level is None:
            level = float(point["level"].values[0])
        point = point.sel(level=level, method="nearest")
    if date:
        point = select_time_safe(point, date)
    arr = point.values.flatten().astype(float)
    arr = arr[np.isfinite(arr)]
    if len(arr) == 0:
        return pd.DataFrame([{}], index=["Empty"])
    stats = {
        "Min": np.min(arr),
        "25%": np.percentile(arr, 25),
        "50%": np.median(arr),
        "Mean": np.mean(arr),
        "75%": np.percentile(arr, 75),
        "Max": np.max(arr),
        "Std": np.std(arr, ddof=0),
        "Var": np.var(arr, ddof=0),
        "Skewness": skew(arr, bias=False),
        "Kurtosis": kurtosis(arr, bias=False),
    }
    return pd.DataFrame([stats], index=[f"({lat:.2f}, {lon:.2f})"])

def plot_point_timeseries(da: xr.DataArray, lat: float, lon: float, level: Optional[float] = None, downsample: int = 0):
    """Build raw time series data for a location.

    Args:
        downsample: If > 0, sample every Nth point to reduce rendering time

    Returns:
        Dict with 'times', 'values', and 'metadata' keys.
    """
    point = da.sel(lat=lat, lon=lon, method="nearest")
    if is_multilevel(da):
        if level is None:
            level = float(point["level"].values[0])
        point = point.sel(level=level, method="nearest")
    times = iso_times_from_coord(point["time"])
    vals = point.values.astype(float)
    mask = np.isfinite(vals)
    times = np.array(times)[mask]
    vals = vals[mask]
    
    # Downsample if requested
    if downsample > 1:
        times = times[::downsample]
        vals = vals[::downsample]
    
    # Return raw data instead of Plotly figure to avoid binary encoding issues
    return {
        "times": times.tolist(),
        "values": vals.tolist(),
        "title": f"Time Series at ({lat}N, {lon}E)" + (f", level={level}" if is_multilevel(da) else ""),
        "xLabel": "Time",
        "yLabel": f"{point.name} ({point.attrs.get('units','')})",
        "varName": point.name or "Variable",
        "units": point.attrs.get('units', '')
    }

def plot_point_histogram(da: xr.DataArray, lat: float, lon: float, level: Optional[float] = None, bins: int = 30):
    """Generate histogram payload (counts/bins) at a specific lat/lon (and level)."""
    point = da.sel(lat=lat, lon=lon, method="nearest")
    if is_multilevel(da):
        if level is None:
            level = float(point["level"].values[0])
        point = point.sel(level=level, method="nearest")
    vals = point.values.astype(float)
    hist = build_histogram(vals, bins)
    return {
        "histogram": hist,
        "title": f"Histogram at ({lat}N, {lon}E)" + (f", level={level}" if is_multilevel(da) else ""),
        "xLabel": f"{point.name} ({point.attrs.get('units','')})",
        "yLabel": "Count",
    }

def plot_point_histogram_month(da: xr.DataArray, lat: float, lon: float, year: int, month: int, level: Optional[float] = None, bins: int = 30):
    """Generate histogram payload at a specific lat/lon for a given month/year."""
    point = da.sel(lat=lat, lon=lon, method="nearest")
    if is_multilevel(da):
        if level is None:
            level = float(point["level"].values[0])
        point = point.sel(level=level, method="nearest")
    start = pd.Timestamp(year=year, month=month, day=1)
    end = start + pd.offsets.MonthEnd(1)
    point = point.sel(time=slice(start, end))
    vals = point.values.astype(float)
    hist = build_histogram(vals, bins)
    return {
        "histogram": hist,
        "title": f"Histogram at ({lat}N, {lon}E) for {year}-{month:02d}" + (f", level={level}" if is_multilevel(da) else ""),
        "xLabel": f"{point.name} ({point.attrs.get('units','')})",
        "yLabel": "Count",
    }

def plot_point_month_histogram_across_years(da: xr.DataArray, lat: float, lon: float, month: int, level: Optional[float] = None, bins: int = 20):
    """Generate histogram payload of a specific month across all years."""
    point = da.sel(lat=lat, lon=lon, method="nearest")
    if is_multilevel(da):
        if level is None:
            level = float(point["level"].values[0])
        point = point.sel(level=level, method="nearest")
    times = pd.to_datetime(iso_times_from_coord(point["time"]))
    vals = point.values.astype(float)
    mask = np.isfinite(vals)
    times = times[mask]
    vals = vals[mask]
    month_mask = times.month == month
    month_vals = vals[month_mask]
    if len(month_vals) == 0:
        raise ValueError(f"No data available for month={month}")
    month_name = pd.to_datetime(f"2000-{month:02d}-01").strftime("%B")
    dataset_name = da.name or "Variable"
    title = (
        f"{month_name} Histogram of {dataset_name} at "
        f"{'Single Level' if not is_multilevel(da) else f'Level {level}'} "
        f"(Lat: {float(point['lat'].values):.2f}° N, Lon: {float(point['lon'].values):.2f}° E)"
    )
    hist = build_histogram(month_vals, bins)
    return {
        "histogram": hist,
        "title": title,
        "xLabel": f"{dataset_name} ({da.attrs.get('units','')})",
        "yLabel": "Count",
    }

def compute_monthly_mean_std(da: xr.DataArray, lat: float, lon: float, year: int, level: Optional[float] = None) -> pd.DataFrame:
    """Compute mean and std for each month of a given year at a specific point."""
    point = da.sel(lat=lat, lon=lon, method="nearest")
    if is_multilevel(da):
        if level is None:
            level = float(point["level"].values[0])
        point = point.sel(level=level, method="nearest")
    times = pd.to_datetime(iso_times_from_coord(point["time"]))
    vals = point.values.astype(float)
    mask = np.isfinite(vals)
    times = times[mask]
    vals = vals[mask]
    df = pd.DataFrame({"Time": times, "Value": vals})
    df["Year"] = df["Time"].dt.year
    df["Month"] = df["Time"].dt.month
    df_year = df[df["Year"] == year]
    if df_year.empty:
        raise ValueError(f"No data available for year {year}")
    stats = df_year.groupby("Month")["Value"].agg(
        Mean="mean", Std="std"
    ).reset_index()
    stats["Month Name"] = stats["Month"].apply(lambda m: pd.to_datetime(f"2000-{m:02d}-01").strftime("%B"))
    return stats.set_index("Month Name")[["Mean", "Std"]]

def compute_monthly_mean_yearly_std(da: xr.DataArray, lat: float, lon: float, year: int, level: Optional[float] = None) -> pd.DataFrame:
    """Compute monthly mean for a specific year and std across all years."""
    point = da.sel(lat=lat, lon=lon, method="nearest")
    if is_multilevel(da):
        if level is None:
            level = float(point["level"].values[0])
        point = point.sel(level=level, method="nearest")
    times = pd.to_datetime(iso_times_from_coord(point["time"]))
    vals = point.values.astype(float)
    mask = np.isfinite(vals)
    times = times[mask]
    vals = vals[mask]
    df = pd.DataFrame({"Time": times, "Value": vals})
    df["Year"] = df["Time"].dt.year
    df["Month"] = df["Time"].dt.month
    df_year = df[df["Year"] == year]
    means = df_year.groupby("Month")["Value"].mean()
    stds = df.groupby("Month")["Value"].agg(lambda x: np.std(x, ddof=0))
    stats = pd.DataFrame({"Mean": means, "Std": stds})
    stats = stats.reset_index()
    stats["Month Name"] = stats["Month"].apply(
        lambda m: pd.to_datetime(f"2000-{m:02d}-01").strftime("%B")
    )
    return stats.set_index("Month Name")[["Mean", "Std"]]

# --- Histogram helper (backend-side binning for Recharts) ---
def build_histogram(values: np.ndarray, bins: int = 30) -> Dict[str, object]:
    """Create histogram bins/counts for Recharts-friendly payload."""
    clean = values[np.isfinite(values)]
    if clean.size == 0:
        return {"bars": [], "bin_edges": [], "bin_centers": [], "counts": []}

    counts, bin_edges = np.histogram(clean, bins=bins)
    bin_centers = (bin_edges[:-1] + bin_edges[1:]) / 2
    bars = [
        {
            "bin_start": float(bin_edges[i]),
            "bin_end": float(bin_edges[i + 1]),
            "bin_center": float(bin_centers[i]),
            "count": int(counts[i]),
        }
        for i in range(len(counts))
    ]
    return {
        "bars": bars,
        "bin_edges": bin_edges.tolist(),
        "bin_centers": bin_centers.tolist(),
        "counts": counts.tolist(),
    }

def compute_seasonal_timeseries(da: xr.DataArray, lat: float, lon: float, month: int, start_year: int, end_year: int, level: Optional[float] = None) -> pd.DataFrame:
    """Extract seasonal time series for a specific month across multiple years."""
    point = da.sel(lat=lat, lon=lon, method="nearest")
    if is_multilevel(da):
        if level is None:
            level = float(point["level"].values[0])
        point = point.sel(level=level, method="nearest")
    times = pd.to_datetime(iso_times_from_coord(point["time"]))
    vals = point.values.astype(float)
    mask = np.isfinite(vals)
    times = times[mask]
    vals = vals[mask]
    df = pd.DataFrame({"Time": times, "Value": vals})
    df["Year"] = df["Time"].dt.year
    df["Month"] = df["Time"].dt.month
    df_season = df[(df["Month"] == month) & (df["Year"].between(start_year, end_year))]
    if df_season.empty:
        raise ValueError(f"No data available for month={month} between {start_year}–{end_year}")
    seasonal_series = df_season[["Year", "Value"]].set_index("Year")
    return seasonal_series

def plot_seasonal_timeseries(da: xr.DataArray, lat: float, lon: float, month: int, start_year: int, end_year: int, level: Optional[float] = None):
    """Return seasonal time series points for Recharts (year/value)."""
    point = da.sel(lat=lat, lon=lon, method="nearest")
    if is_multilevel(da):
        if level is None:
            level = float(point["level"].values[0])
        point = point.sel(level=level, method="nearest")
    times = pd.to_datetime(iso_times_from_coord(point["time"]))
    vals = point.values.astype(float)
    mask = np.isfinite(vals)
    times = times[mask]
    vals = vals[mask]
    df = pd.DataFrame({"Time": times, "Value": vals})
    df["Year"] = df["Time"].dt.year
    df["Month"] = df["Time"].dt.month
    df_season = df[(df["Month"] == month) & (df["Year"].between(start_year, end_year))]
    if df_season.empty:
        raise ValueError(f"No data for month={month} between {start_year}–{end_year}")
    month_name = pd.to_datetime(f"2000-{month:02d}-01").strftime("%B")
    title = f"{month_name} Seasonal Time Series at ({lat}N, {lon}E)"
    if is_multilevel(da):
        title += f" (Level={level})"
    points = [{"x": int(row.Year), "y": float(row.Value)} for row in df_season.itertuples()]
    return {
        "points": points,
        "title": title,
        "xLabel": "Year",
        "yLabel": f"{da.name} ({da.attrs.get('units', '')})",
    }

def plot_monthly_climatology(da: xr.DataArray, lat: float, lon: float, level: Optional[float] = None):
    """Return monthly climatology stats for Recharts (mean/high/low per month)."""
    point = da.sel(lat=lat, lon=lon, method="nearest")
    if is_multilevel(da):
        if level is None:
            level = float(point["level"].values[0])
        point = point.sel(level=level, method="nearest")
    times = pd.to_datetime(iso_times_from_coord(point["time"]))
    vals = point.values.astype(float)
    mask = np.isfinite(vals)
    times = times[mask]
    vals = vals[mask]
    df = pd.DataFrame({"Time": times, "Value": vals})
    df["Month"] = df["Time"].dt.month
    clim = df.groupby("Month")["Value"].agg(
        Climatology="mean",
        HistoricalHigh="max",
        HistoricalLow="min"
    ).reset_index()
    clim["Month Name"] = clim["Month"].apply(
        lambda m: pd.to_datetime(f"2000-{m:02d}-01").strftime("%B")
    )
    dataset_name = da.name or "Variable"
    dataset_units = da.attrs.get("units", "")
    title = (
        f"{dataset_name} | Monthly Climatology "
        f"(Lat: {lat:.2f}° N, Lon: {lon:.2f}° E"
        + (f", Level: {level}" if is_multilevel(da) else "")
        + ")"
    )
    points = [
        {
            "month": row["Month Name"],
            "climatology": float(row["Climatology"]),
            "historical_high": float(row["HistoricalHigh"]),
            "historical_low": float(row["HistoricalLow"]),
        }
        for _, row in clim.iterrows()
    ]
    return {
        "points": points,
        "title": title,
        "xLabel": "Month",
        "yLabel": f"{dataset_name} ({dataset_units})",
    }

def get_monthly_data(da: xr.DataArray, year: int, month: int, level: Optional[float] = None) -> np.ndarray:
    """Extract all valid values for a specific month and year across the spatial domain."""
    try:
        time_vals = da["time"].values
        if isinstance(time_vals[0], (cftime.DatetimeNoLeap, cftime.DatetimeGregorian)):
            time_df = pd.DataFrame({
                "time": [pd.Timestamp(t.year, t.month, t.day) for t in time_vals]
            })
        else:
            time_df = pd.DataFrame({"time": pd.to_datetime(time_vals)})
        
        available_years = sorted(time_df["time"].dt.year.unique())
        if year not in available_years:
            raise ValueError(f"No data found for year {year}. Available years: {available_years}")
        
        mask = (time_df["time"].dt.year == year) & (time_df["time"].dt.month == month)
        if not mask.any():
            raise ValueError(f"No data found for {year}-{month:02d}")
        
        da_month = da.isel(time=mask)
        
        if is_multilevel(da) and level is not None:
            level_dim = "level" if "level" in da.dims else "plev"
            if level not in da[level_dim].values:
                raise ValueError(f"Level {level} not found. Available levels: {da[level_dim].values.tolist()}")
            da_month = da_month.sel({level_dim: level}, method="nearest")
        
        values = da_month.values
        if is_multilevel(da) and level is None:
            level_dim = "level" if "level" in da.dims else "plev"
            da_month = da_month.isel({level_dim: 0})
            values = da_month.values
        
        values_flat = values.flatten()
        valid_values = values_flat[np.isfinite(values_flat)]
        
        if len(valid_values) == 0:
            raise ValueError(f"No valid (non-NaN) data found for {year}-{month:02d}")
        
        return valid_values
    except Exception as e:
        raise ValueError(f"Error extracting monthly data: {str(e)}")

def plot_month_histogram(da: xr.DataArray, year: int, month: int, level: Optional[float] = None, bins: int = 30) -> dict:
    """Generate a histogram for all values in a specific month and year."""
    values = get_monthly_data(da, year, month, level)
    units = da.attrs.get("units", guess_units(da.name))
    title = f"Histogram of {da.name} for {year}-{month:02d}"
    if is_multilevel(da) and level is not None:
        title += f", level={level}"
    hist = build_histogram(values, bins)
    return {
        "histogram": hist,
        "title": title,
        "xLabel": f"{da.name} ({units})",
        "yLabel": "Count",
    }

def sanitize_path(path: str) -> str:
    """Sanitize and validate dataset path (zarr directory only) to prevent traversal."""
    try:
        base = Path(ROOT_DIR).resolve()
        # Decode path if it's URL-encoded
        from urllib.parse import unquote
        decoded_path = unquote(path)
        full_path = (base / decoded_path).resolve()
        if not str(full_path).startswith(str(base)):
            raise HTTPException(status_code=403, detail="Access to file outside dataset directory is forbidden")

        # Allow only zarr directories
        if full_path.is_dir() and (full_path.suffix == ".zarr" or (full_path / ".zmetadata").exists()):
            return str(full_path)

        raise HTTPException(status_code=400, detail="Invalid dataset path: expected zarr store (.zarr dir with .zmetadata)")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid path: {str(e)}")

# --- FastAPI App ---
app = FastAPI(
    title="Dataset API",
    description="API for reading and analyzing datasets (zarr only) from the dataset directory.",
    version="1.0.0"
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def _clean_part(name: str) -> str:
    # Remove parentheses content and trim
    cleaned = name.replace('(', ' ').replace(')', ' ')
    return ' '.join(cleaned.split())

def is_dataset_readable(full_path: str) -> bool:
    """Quick check if a dataset file is readable without fully opening it."""
    try:
        path_str = str(full_path)
        if path_str.endswith('.zarr'):
            # Check if zarr has required files
            return os.path.exists(os.path.join(path_str, 'zarr.json')) or os.path.exists(os.path.join(path_str, '.zmetadata'))
        return False
    except Exception as e:
        print(f"Dataset readability check failed for {full_path}: {str(e)}")
        return False

def list_datasets() -> List[Dict[str, str]]:
    """Recursively find .zarr stores in ROOT_DIR and extract path metadata.

    - dataset_name: Provider + dataset + category (excluding 'Single Level'), e.g.,
      'NOAA GPCP V2.3 Precipitation Monthly Mean Surface'
    - layer_name: The dataset folder (parts[1]) for grouping
    - stat_level: The last folder before the file (e.g., 'Monthly Mean (Surface)')
    """
    datasets: List[Dict[str, str]] = []
    for root, dirs, files in os.walk(ROOT_DIR):
        # Add .zarr directories first
        for d in dirs:
            if d.endswith(".zarr"):
                full_path = os.path.join(root, d)
                # Skip if not readable
                if not is_dataset_readable(full_path):
                    print(f"Skipping unreadable zarr: {full_path}")
                    continue
                rel_path = os.path.normpath(os.path.relpath(full_path, ROOT_DIR)).replace('\\', '/')
                parts = rel_path.split('/')
                # Build display name from parts excluding 'Single Level' and file segment
                display_parts = []
                if len(parts) > 0:
                    display_parts.append(_clean_part(parts[0]))
                if len(parts) > 1:
                    display_parts.append(_clean_part(parts[1]))
                # include all middle folders except 'Single Level'
                middle = parts[2:-1]
                for p in middle:
                    if p.strip().lower() != 'single level':
                        display_parts.append(_clean_part(p))
                display_name = ' '.join(dp for dp in display_parts if dp)
                # stat_level = last folder before the .zarr directory
                stat_level = parts[-2] if len(parts) >= 2 else ''
                datasets.append({
                    "full_path": full_path,
                    "relative_path": rel_path,
                    "dataset_name": display_name or (parts[0] if len(parts) > 0 else ""),
                    "layer_name": parts[1] if len(parts) > 1 else "",
                    "stat_level": _clean_part(stat_level),
                    "file_name": d,
                })
    return datasets

@app.get("/datasets", response_model=List[Dict[str, str]])
async def get_datasets():
    """List available datasets (zarr only) with paths and metadata."""
    return list_datasets()

@app.get("/dataset_info")
async def get_dataset_info(
    path: str = Query(..., description="Relative path to the zarr store from dataset root"),
    variable: Optional[str] = Query(None, description="Variable of interest (optional)"),
    cache_bust: Optional[str] = Query(None, description="Cache busting param (frontend should send a random string when switching datasets)")
):
    """Get information about the dataset: name, variables, chosen variable, colormap, multilevel, levels, units."""
    cache_key = f"{path}||{variable or ''}"
    # If cache_bust is set, skip cache
    if not cache_bust and cache_key in DATASET_INFO_CACHE:
        return DATASET_INFO_CACHE[cache_key]
    full_path = sanitize_path(path)
    try:
        ds, chosen_var, multilevel, levels, units, level_units = open_dataset_flexible(full_path, variable)
        cmap = guess_cmap_name(chosen_var, units)
        variables = list(ds.data_vars)
        dataset_name = os.path.relpath(full_path, ROOT_DIR).split(os.sep)[0]
        result = {
            "dataset_name": dataset_name,
            "variables": variables,
            "chosen_variable": chosen_var,
            "colormap": cmap,
            "multilevel": multilevel,
            "levels": levels.tolist() if levels is not None else [],
            "level_units": level_units,
            "units": units
        }
        DATASET_INFO_CACHE[cache_key] = result
        return result
    except FileNotFoundError:
        return JSONResponse(status_code=404, content={"error": f"Dataset file not found: {path}"})
    except OSError as e:
        if 'NetCDF: Unknown file format' in str(e) or 'NetCDF' in str(e):
            return JSONResponse(status_code=404, content={"error": f"Dataset file is corrupted or unreadable: {path}"})
        return JSONResponse(status_code=500, content={"error": f"Failed to read dataset info: {str(e)}"})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": f"Failed to read dataset info: {str(e)}"})

@app.post("/clear_caches")
async def clear_caches():
    DATASET_INFO_CACHE.clear()
    DATASET_DATES_CACHE.clear()
    TIMESERIES_PLOT_CACHE.clear()
    TIMESERIES_DATA_CACHE.clear()
    return {"status": "all caches cleared"}

@app.get("/dataset_dates")
async def get_dataset_dates(
    path: str = Query(..., description="Relative path to the zarr store from dataset root")
):
    """Get available dates for the dataset, including first and last year."""
    if path in DATASET_DATES_CACHE:
        return DATASET_DATES_CACHE[path]
    
    full_path = sanitize_path(path)
    try:
        with open_dataset(full_path) as ds:
            if "time" not in ds.coords:
                print(f"No time dimension found in {full_path}")
                result = {"dates": [], "first_year": None, "last_year": None}
                DATASET_DATES_CACHE[path] = result
                return result
            dates = iso_times_from_coord(ds["time"])
            years = sorted(list(set(date.split('-')[0] for date in dates)))
            first_year = years[0] if years else None
            last_year = years[-1] if years else None
            result = {
                "dates": sorted(dates),
                "first_year": first_year,
                "last_year": last_year
            }
            DATASET_DATES_CACHE[path] = result
            return result
    except Exception as e:
        print(f"Error in get_dataset_dates for {full_path}: {str(e)}")
        return JSONResponse(status_code=500, content={"error": f"Failed to read dates: {str(e)}"})

@app.get("/api/slice")
async def get_slice(
    path: str = Query(..., description="Relative path to the zarr store"),
    variable: Optional[str] = Query(None, description="Variable of interest (optional)"),
    date: str = Query(..., description="Time slice (YYYY-MM-DD)"),
    center: str = Query("atlantic", description="Map centering: 'atlantic' or 'pacific'"),
    level: Optional[float] = Query(None, description="Level for multilevel datasets (optional)")
):
    """Get a 2D slice of the dataset for a specific time (and level if multilevel)."""
    try:
        full_path = sanitize_path(path)
    except HTTPException as e:
        return JSONResponse(status_code=e.status_code, content={"error": e.detail})
    except Exception as e:
        print(f"Path sanitization error: {str(e)}", flush=True)
        return JSONResponse(status_code=400, content={"error": f"Invalid path: {str(e)}"})
    
    try:
        ds, chosen_var, multilevel, levels, units, level_units = open_dataset_flexible(full_path, variable)
        da = ds[chosen_var]
        da = select_time_safe(da, date)
        if multilevel and level is not None:
            da = da.sel(level=level, method="nearest") if "level" in da.dims else da.sel(plev=level, method="nearest")
        lats = da["lat"].values.tolist()
        lons = da["lon"].values.tolist()
        
        # Convert values to list, ensuring NaN becomes null and arrays stay as arrays
        raw_values = da.values
        values = []
        for row in raw_values:
            if isinstance(row, np.ndarray):
                # Convert each row, replacing NaN with None (becomes null in JSON)
                converted_row = [float(v) if np.isfinite(v) else None for v in row]
                values.append(converted_row)
            else:
                # Fallback for non-array rows
                values.append([float(row) if np.isfinite(row) else None])
        
        # Calculate min/max only from finite values
        flat_values = raw_values.flatten()
        finite_values = flat_values[np.isfinite(flat_values)]
        if len(finite_values) > 0:
            min_val = float(np.min(finite_values))
            max_val = float(np.max(finite_values))
        else:
            min_val = 0.0
            max_val = 1.0
        
        print(f"[SLICE] center={center}, atlantic={center == 'atlantic'}, pacific={center == 'pacific'}")
        
        if center == "pacific":
            # For Pacific centering, we need to find the dateline (0 degrees) and roll data there
            # Find index where longitude crosses from negative to positive (or wraps around)
            lons_array = np.array(lons)
            
            # Find the "seam" - the index where we should split
            # Look for the largest gap between consecutive longitudes
            lon_diffs = np.diff(np.concatenate([[lons_array[-1] - 360], lons_array]))
            seam_idx = np.argmax(lon_diffs)
            
            print(f"[PACIFIC] lons range: [{lons_array[0]}, ..., {lons_array[-1]}]")
            print(f"[PACIFIC] seam_idx: {seam_idx}, lon_diffs max: {lon_diffs[seam_idx]}")
            
            # Roll the data and longitudes
            values_array = np.array(values)
            rolled_values = np.roll(values_array, -seam_idx, axis=1)
            rolled_lons = np.roll(lons_array, -seam_idx)
            
            # Convert rolled lons to 0-360 range for Pacific view
            rolled_lons = np.where(rolled_lons < 0, rolled_lons + 360, rolled_lons)
            
            print(f"[PACIFIC] rolled lons range: [{rolled_lons[0]}, ..., {rolled_lons[-1]}]")
            
            lons = rolled_lons.tolist()
            values = rolled_values.tolist()
        
        return {
            "var": chosen_var,
            "date_selected": date,
            "lats": lats,
            "lons": lons,
            "values": values,
            "min": min_val,
            "max": max_val,
            "units": units
        }
    except Exception as e:
        print(f"Slice error: {str(e)}", flush=True)
        import traceback
        traceback.print_exc()
        return JSONResponse(status_code=500, content={"error": f"Failed to fetch slice: {str(e)}"})

@app.get("/statistics")
async def get_statistics(
    path: str = Query(..., description="Relative path to the zarr store"),
    variable: Optional[str] = Query(None, description="Variable of interest (optional)"),
    time: Optional[str] = Query(None, description="Time slice (YYYY-MM-DD, optional)")
):
    """Compute descriptive statistics for the dataset (optionally at a specific time)."""
    full_path = sanitize_path(path)
    try:
        ds, chosen_var, _, _, _, _ = open_dataset_flexible(full_path, variable)
        da = ds[chosen_var]
        if time:
            da = select_time_safe(da, time)
        stats_df = compute_statistics(da)
        return json.loads(stats_df.to_json(orient="index", double_precision=10), cls=NumpyEncoder)
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": f"Failed to compute statistics: {str(e)}"})

@app.get("/point_statistics")
async def get_point_statistics(
    path: str = Query(..., description="Relative path to the zarr store"),
    lat: float = Query(..., description="Latitude", ge=-90, le=90),
    lon: float = Query(..., description="Longitude", ge=-180, le=180),
    variable: Optional[str] = Query(None, description="Variable of interest (optional)"),
    level: Optional[float] = Query(None, description="Level for multilevel datasets (optional)"),
    date: Optional[str] = Query(None, description="Time slice (YYYY-MM-DD, optional)")
):
    """Compute descriptive statistics at a specific lat/lon (and level, date if provided)."""
    full_path = sanitize_path(path)
    try:
        ds, chosen_var, multilevel, levels, _, level_units = open_dataset_flexible(full_path, variable)
        da = ds[chosen_var]
        if multilevel and level is not None:
            level_dim = "level" if "level" in da.dims else "plev"
            if level not in da[level_dim].values:
                raise HTTPException(status_code=400, detail=f"Level {level} not found")
            da = da.sel({level_dim: level}, method="nearest")
        stats_df = compute_point_statistics(da, lat, lon, level, date)
        # Fix: Remove cls=NumpyEncoder; to_json handles NaN as null
        json_str = stats_df.to_json(orient="index", date_format="iso", double_precision=10)
        return json.loads(json_str)  # Simple parse to convert string to JSON
    except Exception as e:
        print(f"Error in point_statistics: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to compute point statistics: {str(e)}")

@app.get("/plot_timeseries")
async def get_plot_timeseries(
    path: str = Query(..., description="Relative path to the zarr store"),
    lat: float = Query(..., description="Latitude", ge=-90, le=90),
    lon: float = Query(..., description="Longitude", ge=-180, le=180),
    variable: Optional[str] = Query(None, description="Variable of interest (optional)"),
    level: Optional[float] = Query(None, description="Level for multilevel datasets (optional)"),
    downsample: int = Query(0, description="Downsample: 0=none, 1=skip every point, 2=every 2nd, etc")
):
    """Get timeseries data for a specific lat/lon (and level)."""
    full_path = sanitize_path(path)
    
    # Create cache key
    cache_key = f"{path}||{variable or ''}||{lat}||{lon}||{level or 'none'}||{downsample}"
    
    # Check cache first
    if cache_key in TIMESERIES_PLOT_CACHE:
        return TIMESERIES_PLOT_CACHE[cache_key]
    
    # Prevent duplicate concurrent requests
    if cache_key not in REQUEST_LOCKS:
        REQUEST_LOCKS[cache_key] = asyncio.Lock()
    
    async with REQUEST_LOCKS[cache_key]:
        # Double-check cache after acquiring lock
        if cache_key in TIMESERIES_PLOT_CACHE:
            return TIMESERIES_PLOT_CACHE[cache_key]
        
        try:
            ds, chosen_var, _, _, _, _ = open_dataset_flexible(full_path, variable)
            da = ds[chosen_var]
            data = plot_point_timeseries(da, lat, lon, level, downsample)
            
            TIMESERIES_PLOT_CACHE[cache_key] = data
            return data
        except Exception as e:
            import traceback
            print(f"Error in plot_timeseries: {str(e)}")
            traceback.print_exc()
            return JSONResponse(status_code=500, content={"error": f"Failed to generate timeseries plot: {str(e)}"})

@app.get("/plot_histogram")
async def get_plot_histogram(
    path: str = Query(..., description="Relative path to the zarr store"),
    lat: float = Query(..., description="Latitude", ge=-90, le=90),
    lon: float = Query(..., description="Longitude", ge=-180, le=180),
    variable: Optional[str] = Query(None, description="Variable of interest (optional)"),
    level: Optional[float] = Query(None, description="Level for multilevel datasets (optional)"),
    bins: int = Query(30, description="Number of bins for histogram")
):
    """Get histogram data at a specific lat/lon (and level)."""
    full_path = sanitize_path(path)
    try:
        ds, chosen_var, _, _, _, _ = open_dataset_flexible(full_path, variable)
        da = ds[chosen_var]
        return plot_point_histogram(da, lat, lon, level, bins)
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": f"Failed to generate histogram: {str(e)}"})

@app.get("/month_histogram")
async def get_month_histogram(
    path: str = Query(..., description="Relative path to the zarr store"),
    variable: Optional[str] = Query(None, description="Variable of interest (optional)"),
    year: int = Query(..., description="Year for the histogram (e.g., 2020)"),
    month: int = Query(..., description="Month for the histogram (1-12)", ge=1, le=12),
    level: Optional[float] = Query(None, description="Level for multilevel datasets (optional)"),
    bins: int = Query(30, description="Number of bins for histogram")
):
    """Generate a histogram of values for a specific month and year across the spatial domain."""
    full_path = sanitize_path(path)
    try:
        ds, chosen_var, _, _, _, _ = open_dataset_flexible(full_path, variable)
        da = ds[chosen_var]
        return plot_month_histogram(da, year, month, level, bins)
    except ValueError as ve:
        return JSONResponse(status_code=400, content={"error": str(ve)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": f"Failed to generate histogram: {str(e)}"})

@app.get("/plot_histogram_month")
async def get_plot_histogram_month(
    path: str = Query(..., description="Relative path to the zarr store"),
    lat: float = Query(..., description="Latitude", ge=-90, le=90),
    lon: float = Query(..., description="Longitude", ge=-180, le=180),
    year: int = Query(..., description="Year for the histogram (e.g., 2020)"),
    month: int = Query(..., description="Month for the histogram (1-12)", ge=1, le=12),
    variable: Optional[str] = Query(None, description="Variable of interest (optional)"),
    level: Optional[float] = Query(None, description="Level for multilevel datasets (optional)"),
    bins: int = Query(30, description="Number of bins for histogram")
):
    """Get histogram at a specific lat/lon for a given month/year."""
    full_path = sanitize_path(path)
    try:
        ds, chosen_var, _, _, _, _ = open_dataset_flexible(full_path, variable)
        da = ds[chosen_var]
        return plot_point_histogram_month(da, lat, lon, year, month, level, bins)
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": f"Failed to generate histogram: {str(e)}"})

@app.get("/plot_month_histogram_across_years")
async def get_plot_month_histogram_across_years(
    path: str = Query(..., description="Relative path to the zarr store"),
    lat: float = Query(..., description="Latitude", ge=-90, le=90),
    lon: float = Query(..., description="Longitude", ge=-180, le=180),
    month: int = Query(..., description="Month for the histogram (1-12)", ge=1, le=12),
    variable: Optional[str] = Query(None, description="Variable of interest (optional)"),
    level: Optional[float] = Query(None, description="Level for multilevel datasets (optional)"),
    bins: int = Query(20, description="Number of bins for histogram")
):
    """Get histogram of a specific month across all years."""
    full_path = sanitize_path(path)
    try:
        ds, chosen_var, _, _, _, _ = open_dataset_flexible(full_path, variable)
        da = ds[chosen_var]
        return plot_point_month_histogram_across_years(da, lat, lon, month, level, bins)
    except ValueError as ve:
        return JSONResponse(status_code=400, content={"error": str(ve)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": f"Failed to generate histogram: {str(e)}"})

@app.get("/monthly_mean_std")
async def get_monthly_mean_std(
    path: str = Query(..., description="Relative path to the zarr store"),
    lat: float = Query(..., description="Latitude", ge=-90, le=90),
    lon: float = Query(..., description="Longitude", ge=-180, le=180),
    year: int = Query(..., description="Year for the statistics (e.g., 2020)"),
    variable: Optional[str] = Query(None, description="Variable of interest (optional)"),
    level: Optional[float] = Query(None, description="Level for multilevel datasets (optional)")
):
    """Compute mean and std for each month of a given year at a specific point."""
    full_path = sanitize_path(path)
    try:
        ds, chosen_var, _, _, _, _ = open_dataset_flexible(full_path, variable)
        da = ds[chosen_var]
        stats_df = compute_monthly_mean_std(da, lat, lon, year, level)
        return json.loads(stats_df.to_json(orient="index", double_precision=10), cls=NumpyEncoder)
    except ValueError as ve:
        return JSONResponse(status_code=400, content={"error": str(ve)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": f"Failed to compute statistics: {str(e)}"})

@app.get("/monthly_mean_yearly_std")
async def get_monthly_mean_yearly_std(
    path: str = Query(..., description="Relative path to the zarr store"),
    lat: float = Query(..., description="Latitude", ge=-90, le=90),
    lon: float = Query(..., description="Longitude", ge=-180, le=180),
    year: int = Query(..., description="Year for the mean statistics (e.g., 2020)"),
    variable: Optional[str] = Query(None, description="Variable of interest (optional)"),
    level: Optional[float] = Query(None, description="Level for multilevel datasets (optional)")
):
    """Compute monthly mean for a specific year and std across all years."""
    full_path = sanitize_path(path)
    try:
        ds, chosen_var, _, _, _, _ = open_dataset_flexible(full_path, variable)
        da = ds[chosen_var]
        stats_df = compute_monthly_mean_yearly_std(da, lat, lon, year, level)
        return json.loads(stats_df.to_json(orient="index", double_precision=10), cls=NumpyEncoder)
    except ValueError as ve:
        return JSONResponse(status_code=400, content={"error": str(ve)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": f"Failed to compute statistics: {str(e)}"})

@app.get("/seasonal_timeseries")
async def get_seasonal_timeseries(
    path: str = Query(..., description="Relative path to the zarr store"),
    lat: float = Query(..., description="Latitude", ge=-90, le=90),
    lon: float = Query(..., description="Longitude", ge=-180, le=180),
    month: int = Query(..., description="Month for the time series (1-12)", ge=1, le=12),
    start_year: int = Query(..., description="Start year for the time series"),
    end_year: int = Query(..., description="End year for the time series"),
    variable: Optional[str] = Query(None, description="Variable of interest (optional)"),
    level: Optional[float] = Query(None, description="Level for multilevel datasets (optional)")
):
    """Get seasonal time series for a specific month across multiple years."""
    full_path = sanitize_path(path)
    try:
        ds, chosen_var, _, _, _, _ = open_dataset_flexible(full_path, variable)
        da = ds[chosen_var]
        stats_df = compute_seasonal_timeseries(da, lat, lon, month, start_year, end_year, level)
        return json.loads(stats_df.to_json(orient="index", double_precision=10), cls=NumpyEncoder)
    except ValueError as ve:
        return JSONResponse(status_code=400, content={"error": str(ve)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": f"Failed to compute seasonal time series: {str(e)}"})

@app.get("/plot_seasonal_timeseries")
async def get_plot_seasonal_timeseries(
    path: str = Query(..., description="Relative path to the zarr store"),
    lat: float = Query(..., description="Latitude", ge=-90, le=90),
    lon: float = Query(..., description="Longitude", ge=-180, le=180),
    month: int = Query(..., description="Month for the time series (1-12)", ge=1, le=12),
    start_year: int = Query(..., description="Start year for the time series"),
    end_year: int = Query(..., description="End year for the time series"),
    variable: Optional[str] = Query(None, description="Variable of interest (optional)"),
    level: Optional[float] = Query(None, description="Level for multilevel datasets (optional)")
):
    """Get seasonal time series data for a location."""
    full_path = sanitize_path(path)
    try:
        ds, chosen_var, _, _, _, _ = open_dataset_flexible(full_path, variable)
        da = ds[chosen_var]
        return plot_seasonal_timeseries(da, lat, lon, month, start_year, end_year, level)
    except ValueError as ve:
        return JSONResponse(status_code=400, content={"error": str(ve)})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": f"Failed to generate seasonal timeseries plot: {str(e)}"})

@app.get("/plot_monthly_climatology")
async def get_plot_monthly_climatology(
    path: str = Query(..., description="Relative path to the zarr store"),
    lat: float = Query(..., description="Latitude", ge=-90, le=90),
    lon: float = Query(..., description="Longitude", ge=-180, le=180),
    variable: Optional[str] = Query(None, description="Variable of interest (optional)"),
    level: Optional[float] = Query(None, description="Level for multilevel datasets (optional)")
):
    """Get monthly climatology data for a location."""
    full_path = sanitize_path(path)
    try:
        ds, chosen_var, _, _, _, _ = open_dataset_flexible(full_path, variable)
        da = ds[chosen_var]
        return plot_monthly_climatology(da, lat, lon, level)
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": f"Failed to generate climatology plot: {str(e)}"})

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)