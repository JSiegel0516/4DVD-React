import os

DATA_PATH = os.environ.get("CLIMATE_DATA_PATH", r"C:\Users\jsieg\Documents\4dvd-clone\backend\downloads\precip.mon.mean.nc")
DEFAULT_VAR = os.environ.get("CLIMATE_DATA_VAR", "precip")
DOWNSAMPLE = int(os.environ.get("SLICE_DOWNSAMPLE", "1"))
