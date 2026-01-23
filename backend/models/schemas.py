from typing import List, Optional, Dict, Any
from pydantic import BaseModel

class DatasetVarInfo(BaseModel):
    name: str
    long_name: Optional[str] = None
    units: Optional[str] = None
    dims: List[str]
    shape: List[int]
    colormap_suggested: str
    global_min: float
    global_max: float

class DatasetMetadata(BaseModel):
    dataset_title: Optional[str] = None
    global_attrs: Dict[str, Any]
    variables: List[DatasetVarInfo]
    times: List[str]

class TimeSliceResponse(BaseModel):
    var: str
    date_selected: str
    units: Optional[str] = None
    colormap_suggested: str
    lats: List[float]
    lons: List[float]
    values: List[List[Optional[float]]]
    center: str

class TimeSeriesResponse(BaseModel):
    var: str
    lat: float
    lon: float
    units: Optional[str] = None
    data: List[Dict[str, Any]]
    plotly_json: Optional[Dict[str, Any]] = None

class XYZResponse(BaseModel):
    lat: float
    lon: float
    value: Optional[float]
    var: str
    units: Optional[str]
    date: Optional[str]
    center: str
