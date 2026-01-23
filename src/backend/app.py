from flask import Flask, jsonify
import xarray as xr
import numpy as np
from flask_cors import CORS

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "http://localhost:3000"}})

# Load the ERA5 dataset
ds = xr.open_dataset(r"C:\Users\jsieg\Documents\4dvd-clone\src\backend\dataset.nc", engine="netcdf4")
print("Dataset time values:", ds["valid_time"].values)  # Debug time dimension
print("Geopotential shape:", ds["z"].shape)            # Debug shape
print("Geopotential min/max:", ds["z"].min().values, ds["z"].max().values)  # Debug range

# Convert geopotential (m²/s²) to geopotential height (m) by dividing by g = 9.81 m/s²
g = 9.81
geopotential_height = ds["z"] / g  # Shape: (7, 1, 721, 1440)

# Select a single time step
geo_height_data = geopotential_height.isel(valid_time=0, pressure_level=0).values


lat = ds["latitude"].values[::4]  # Downsample latitude (721 -> ~180)
lon = ds["longitude"].values[::4]  # Downsample longitude (1440 -> ~360)
geo_height_data = geo_height_data[::4, ::4]  # Downsample to (180, 360)

# Convert to a flat list of [lat, lon, value] for globe compatibility
def prepare_globe_data(height):
    data = []
    for i in range(len(lat)):
        for j in range(len(lon)):
            if not np.isnan(height[i, j]):  # Skip NaN values
                data.append([float(lat[i]), float(lon[j]), float(height[i, j])])
    return data

@app.route('/api/geopotential')
def get_geopotential():
    globe_data = prepare_globe_data(geo_height_data)
    return jsonify(globe_data)

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)