import xarray as xr
import pandas as pd
import cftime
import numpy as np
from typing import Optional

def open_dataset_flexible(path: str, variable_of_interest: Optional[str] = None):
    ds = xr.open_dataset(path, decode_times=True, use_cftime=True)
    if "time" in ds.coords:
        time_vals = ds["time"].values
        if isinstance(time_vals[0], (cftime.DatetimeNoLeap, cftime.DatetimeGregorian)):
            pass
        elif pd.api.types.is_numeric_dtype(time_vals):
            units = ds["time"].attrs.get("units", "days since 1800-01-01")
            ref_date = units.split("since")[-1].strip()
            ds["time"] = pd.to_datetime(ref_date) + pd.to_timedelta(time_vals, unit="D")
    if variable_of_interest is None:
        variable_of_interest = list(ds.data_vars)[-1]
    return ds, variable_of_interest

def select_time_slice(ds: xr.Dataset, var: str, date: Optional[str] = None) -> xr.DataArray:
    da = ds[var]
    if "time" not in da.dims:
        return da
    if date is None:
        return da.isel(time=0)
    try:
        target = pd.to_datetime(date)
        if isinstance(da["time"].values[0], (cftime.DatetimeNoLeap, cftime.DatetimeGregorian, cftime.DatetimeProlepticGregorian)):
            target = cftime.DatetimeGregorian(target.year, target.month, target.day)
        return da.sel(time=target, method="nearest")
    except Exception:
        return da.isel(time=0)

def nearest_point_timeseries(ds: xr.Dataset, var: str, lat: float, lon: float) -> xr.DataArray:
    if "lon" in ds.coords:
        lon_vals = ds["lon"].values
        if lon < 0 and np.nanmax(lon_vals) > 180:
            lon = (lon + 360) % 360
    return ds[var].sel(lat=lat, lon=lon, method="nearest")
