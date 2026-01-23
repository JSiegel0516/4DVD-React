import xarray as xr
import cartopy.crs as ccrs
import matplotlib.pyplot as plt

# Load dataset
ds = xr.open_dataset(r'C:\Users\jsieg\Documents\4dvd-clone\src\backend\dataset.nc')
geopotential = ds['z'].isel(valid_time=0)  # First time step

# Plot on globe
fig = plt.figure(figsize=(10, 5))
ax = plt.axes(projection=ccrs.PlateCarree())
geopotential.plot(ax=ax, transform=ccrs.PlateCarree(), cmap='viridis')
ax.coastlines()
plt.show()