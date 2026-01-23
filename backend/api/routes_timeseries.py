from fastapi import APIRouter, Query, HTTPException
from typing import Optional, Literal
from models.schemas import TimeSeriesResponse
from core.dataset import nearest_point_timeseries
from core.utils import iso_times_from_coord
from services.plotting import make_timeseries_plot

router = APIRouter()

@router.get("/timeseries", response_model=TimeSeriesResponse)
def timeseries(
    lat: float = Query(...),
    lon: float = Query(...),
    var: Optional[str] = None,
    include_plot: Literal["none", "plotly_json"] = "plotly_json",
):
    from main import DS, VAR
    if DS is None:
        raise HTTPException(status_code=503, detail="Dataset not loaded.")

    v = var or VAR
    if v not in DS.data_vars:
        raise HTTPException(status_code=400, detail=f"Variable '{v}' not found.")

    ts = nearest_point_timeseries(DS, v, lat, lon)
    times = iso_times_from_coord(ts["time"])
    vals = [None if not float(x) else float(x) for x in ts.values]
    units = ts.attrs.get("units")

    payload = [{"time": t, "value": val} for t, val in zip(times, vals)]
    out = TimeSeriesResponse(var=v, lat=lat, lon=lon, units=units, data=payload)

    if include_plot == "plotly_json":
        out.plotly_json = make_timeseries_plot(payload, v, lat, lon, units)

    return out
