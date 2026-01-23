from fastapi import APIRouter, Query, HTTPException
from typing import Optional, Literal
import math
from models.schemas import XYZResponse
from core.dataset import select_time_slice
from core.utils import iso_times_from_coord

router = APIRouter()

@router.get("/xyz", response_model=XYZResponse)
def get_from_xyz(
    x: float = Query(...),
    y: float = Query(...),
    z: float = Query(...),
    var: Optional[str] = None,
    date: Optional[str] = None,
    center: Literal["atlantic", "pacific"] = "atlantic",
):
    from main import DS, VAR
    if DS is None:
        raise HTTPException(status_code=503, detail="Dataset not loaded.")

    v = var or VAR
    if v not in DS.data_vars:
        raise HTTPException(status_code=400, detail=f"Variable '{v}' not found.")

    # Convert XYZ → lat/lon
    r = math.sqrt(x**2 + y**2 + z**2)
    phi = math.acos(y / r)
    theta = math.atan2(-x, z)
    lat = 90 - (phi * 180 / math.pi)
    lon = (theta * 180 / math.pi)

    lon_vals = DS["lon"].values
    if lon < 0 and lon_vals.max() > 180:
        lon = (lon + 360) % 360

    display_lon = lon
    if center == "atlantic" and lon > 180:
        display_lon = lon - 360
    elif center == "pacific" and lon < 0:
        display_lon = lon + 360

    da = select_time_slice(DS, v, date)
    val = da.sel(lat=lat, lon=lon, method="nearest").item()
    date_selected = iso_times_from_coord(da["time"])[0] if "time" in da.coords else (date or "N/A")

    return XYZResponse(
        lat=float(lat),
        lon=float(display_lon),
        value=None if not math.isfinite(val) else float(val),
        var=v,
        units=da.attrs.get("units"),
        date=date_selected,
        center=center,
    )
