from fastapi import APIRouter, Query, HTTPException
import numpy as np
from typing import Optional, Literal
from models.schemas import TimeSliceResponse
from core.dataset import select_time_slice
from core.utils import iso_times_from_coord, downsample_grid
from core.colormap import guess_cmap_name
from core.config import DOWNSAMPLE

router = APIRouter()

@router.get("/slice", response_model=TimeSliceResponse)
def get_slice(
    var: Optional[str] = None,
    date: Optional[str] = Query(None),
    downsample: int = Query(DOWNSAMPLE, ge=1, le=20),
    center: Literal["atlantic", "pacific"] = "atlantic",
):
    from main import DS, VAR
    if DS is None:
        raise HTTPException(status_code=503, detail="Dataset not loaded.")
    v = var or VAR
    if v not in DS.data_vars:
        raise HTTPException(status_code=400, detail=f"Variable '{v}' not found.")

    da = select_time_slice(DS, v, date)
    date_selected = iso_times_from_coord(da["time"])[0] if "time" in da.coords else (date or "N/A")

    # Ensure latitude is in ascending order (South to North: -90 to 90)
    if da["lat"].values[0] > da["lat"].values[-1]:
        da = da.sortby("lat")

    # Handle longitude coordinate transformation
    lon_vals = da["lon"].values
    
    if center == "atlantic":
        # Convert from 0-360 to -180 to 180 for Atlantic centering
        # This puts the Prime Meridian (0°) in the center
        lon_converted = np.where(lon_vals > 180, lon_vals - 360, lon_vals)
        
        # Create new coordinate and reindex to sort properly
        da = da.assign_coords(lon=lon_converted)
        da = da.sortby("lon")
        
    elif center == "pacific":
        # Keep 0-360 range for Pacific centering
        # This puts 180° (dateline) in the center
        lon_converted = np.where(lon_vals < 0, lon_vals + 360, lon_vals)
        da = da.assign_coords(lon=lon_converted)
        da = da.sortby("lon")

    lats = da["lat"].values
    lons = da["lon"].values
    vals = np.array(da.values)
    if vals.ndim != 2:
        raise HTTPException(status_code=400, detail="Expected 2D (lat, lon) after time selection.")

    lats_ds, lons_ds, vals_ds = downsample_grid(lats, lons, vals, downsample)
    units = (da.attrs or {}).get("units")
    cmap = guess_cmap_name(v, units or "")
    
    # Convert to list, preserving NaN as None for JSON
    vals_list = np.where(np.isfinite(vals_ds), vals_ds, None).tolist()
    
    # Compute min/max from valid values only
    valid_vals = vals_ds[np.isfinite(vals_ds)]
    actual_min = float(np.min(valid_vals)) if len(valid_vals) > 0 else 0.0
    actual_max = float(np.max(valid_vals)) if len(valid_vals) > 0 else 1.0
    
    print(f"[SLICE] {v} {date_selected} | center={center} | lat:[{lats_ds[0]:.1f},{lats_ds[-1]:.1f}] lon:[{lons_ds[0]:.1f},{lons_ds[-1]:.1f}] | values:[{actual_min:.1f},{actual_max:.1f}] | shape:{vals_ds.shape} | valid:{len(valid_vals)}/{vals_ds.size}")

    return TimeSliceResponse(
        var=v,
        date_selected=date_selected,
        units=units,
        colormap_suggested=cmap,
        lats=[float(x) for x in lats_ds],
        lons=[float(x) for x in lons_ds],
        values=vals_list,
        center=center,
    )
