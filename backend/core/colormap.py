def guess_cmap_name(varname: str, units: str) -> str:
    name = varname.lower()
    u = (units or "").lower()
    if any(k in name for k in ["anom", "anomaly", "difference"]):
        return "coolwarm"
    if any(k in u for k in ["k", "°c", "degc", "kelvin", "celsius", "temperature"]):
        return "turbo"
    if any(k in name for k in ["precip", "rain", "snow", "snod", "pr"]):
        return "viridis"
    if any(k in name for k in ["wind", "speed"]):
        return "plasma"
    return "viridis"
