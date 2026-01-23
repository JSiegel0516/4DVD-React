import pandas as pd
import plotly.express as px
import plotly.io as pio
import json

def make_timeseries_plot(payload, var: str, lat: float, lon: float, units: str = None):
    df = pd.DataFrame(payload)
    fig = px.line(
        df, x="time", y="value",
        title=f"{var} at ({lat:.2f}, {lon:.2f})",
        labels={"time": "Time", "value": f"{var} ({units})" if units else var}
    )
    fig.update_layout(hovermode="x unified")
    return json.loads(pio.to_json(fig))
