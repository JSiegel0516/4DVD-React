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

    print(f"DEBUG: get_slice called with center={center}")
    
    da = select_time_slice(DS, v, date)
    date_selected = iso_times_from_coord(da["time"])[0] if "time" in da.coords else (date or "N/A")

    # Ensure latitude is in ascending order (South to North: -90 to 90)
    if da["lat"].values[0] > da["lat"].values[-1]:
        da = da.sortby("lat")

    # Normalize longitude to [-180, 180) and sort (backend-safe standard)
    # This ensures consistent output regardless of input format (0-360 or -180-180)
    # Frontend handles visual centering via texture offset calculation
    lon_vals = da["lon"].values
    lon_normalized = ((lon_vals + 180) % 360) - 180
    da = da.assign_coords(lon=lon_normalized).sortby("lon")

    lats = da["lat"].values
    lons = da["lon"].values
    vals = np.array(da.values)
    if vals.ndim != 2:
        raise HTTPException(status_code=400, detail="Expected 2D (lat, lon) after time selection.")

    # Compute min/max from valid values only
    valid_vals = vals_ds[np.isfinite(vals_ds)]
    actual_min = float(np.min(valid_vals)) if len(valid_vals) > 0 else 0.0
    actual_max = float(np.max(valid_vals)) if len(valid_vals) > 0 else 1.0
    
    # Convert to list, preserving NaN as None for JSON
    vals_list = np.where(np.isfinite(vals_ds), vals_ds, None).tolist()
    lons_list = lons_ds.tolist()
    lats_list = lats_ds.tolist()
    
    # Apply Pacific centering if requested
    if center == "pacific":
        # Find the "seam" - the index where we should split (dateline)
        # Look for where longitudes jump from near 180 to near -180 (or high to low)
        lons_array = np.array(lons_list)
        
        # Find the largest negative jump (where the dateline is)
        lon_diffs = np.diff(lons_array)
        # Look for the largest negative jump (which indicates crossing the dateline)
        seam_idx = np.argmin(lon_diffs) + 1  # +1 because argmin gives index before the jump
        
        print(f"[PACIFIC] lons range: [{lons_array[0]:.1f}, ..., {lons_array[-1]:.1f}]")
        print(f"[PACIFIC] lon_diffs min: {np.min(lon_diffs):.1f} at index {np.argmin(lon_diffs)}")
        print(f"[PACIFIC] seam_idx: {seam_idx}")
        
        # Roll the data and longitudes
        vals_array = np.array(vals_list)
        rolled_values = np.roll(vals_array, -seam_idx, axis=1)
        rolled_lons = np.roll(lons_array, -seam_idx)
        
        # Convert rolled lons to 0-360 range for Pacific view
        rolled_lons = np.where(rolled_lons < 0, rolled_lons + 360, rolled_lons)
        
        print(f"[PACIFIC] rolled lons range: [{rolled_lons[0]:.1f}, ..., {rolled_lons[-1]:.1f}]")
        
        lons_list = rolled_lons.tolist()
        vals_list = rolled_values.tolist()
    
    print(f"[SLICE] {v} {date_selected} | center={center} | lat:[{lats_ds[0]:.1f},{lats_ds[-1]:.1f}] lon:[{lons_list[0]:.1f},{lons_list[-1]:.1f}] | values:[{actual_min:.1f},{actual_max:.1f}] | shape:{vals_ds.shape} | valid:{len(valid_vals)}/{vals_ds.size}")

    return TimeSliceResponse(
        var=v,
        date_selected=date_selected,
        units=units,
        colormap_suggested=cmap,
        lats=lats_list,
        lons=lons_list,
        values=vals_list,
        center=center,
    )
