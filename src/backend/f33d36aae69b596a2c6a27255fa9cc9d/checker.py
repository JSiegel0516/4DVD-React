# C:\Users\jsieg\Documents\4dvd-clone\src\backend\checker.py
import xarray as xr

# Use the full path to the file
ds = xr.open_dataset("cobra_precip_2000-2017.nc", engine="netcdf4")
print(ds)