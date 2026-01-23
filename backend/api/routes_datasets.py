from fastapi import APIRouter, HTTPException
from models.schemas import DatasetMetadata, DatasetVarInfo
from core.utils import iso_times_from_coord, data_min_max
from core.colormap import guess_cmap_name

router = APIRouter()

@router.get("/datasets/metadata", response_model=DatasetMetadata)
def datasets_metadata():
    from main import DS
    if DS is None:
        raise HTTPException(status_code=503, detail="Dataset not loaded.")

    times = iso_times_from_coord(DS["time"]) if "time" in DS.coords else []
    vars_info = []
    for v in DS.data_vars:
        da = DS[v]
        attrs = da.attrs or {}
        units = attrs.get("units")
        long_name = attrs.get("long_name") or attrs.get("standard_name") or v
        gminmax = data_min_max(da)
        vars_info.append(
            DatasetVarInfo(
                name=v,
                long_name=long_name,
                units=units,
                dims=list(da.dims),
                shape=list(da.shape),
                colormap_suggested=guess_cmap_name(v, units or ""),
                global_min=gminmax["min"],
                global_max=gminmax["max"],
            )
        )
    title = DS.attrs.get("title") or DS.attrs.get("history") or None
    return DatasetMetadata(dataset_title=title, global_attrs=dict(DS.attrs), variables=vars_info, times=times)

@router.get("/variables")
def list_variables():
    from main import DS
    if DS is None:
        raise HTTPException(status_code=503, detail="Dataset not loaded.")
    out = []
    for v in DS.data_vars:
        attrs = DS[v].attrs or {}
        out.append({
            "name": v,
            "long_name": attrs.get("long_name") or attrs.get("standard_name") or v,
            "units": attrs.get("units"),
            "dims": list(DS[v].dims),
            "shape": list(DS[v].shape),
        })
    return out
