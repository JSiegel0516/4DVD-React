import xarray as xr
import glob

# Find all NetCDF files (adjust the pattern based on your file names)
file_pattern = "C:\\Users\\jsieg\\Documents\\4dvd-clone\\src\\backend\\f33d36aae69b596a2c6a27255fa9cc9d\\*.nc"  # Update if in a subdirectory
nc_files = glob.glob(file_pattern)

if not nc_files:
    print("No .nc files found. Check the file pattern or directory.")
    exit()

# Load and combine all files along the time dimension
datasets = [xr.open_dataset(f, engine="netcdf4") for f in nc_files]
combined_ds = xr.concat(datasets, dim="time")

# Save to a single file
combined_ds.to_netcdf("cobra_precip_2000-2017.nc")
print("Merged file saved as cobra_precip_2000-2017.nc")