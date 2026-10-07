from pathlib import Path

import numpy as np
import pandas as pd

rng = np.random.default_rng(42)

n = 1800

temperature = rng.normal(72, 8, n)
vibration = rng.normal(4.2, 1.8, n)
pressure = rng.normal(100, 18, n)
load = rng.normal(58, 18, n)
power = rng.normal(52, 16, n)

# Realistic operating ranges with failure risk encoded using a latent rule.
condition = (
    (temperature > 85) * 0.55
    + (vibration > 7.5) * 0.85
    + (pressure > 130) * 0.70
    + (load > 85) * 0.75
    + (power > 80) * 0.45
)

failure_prob = np.clip(condition / 1.0, 0, 1)

failure = (rng.random(n) < failure_prob).astype(int)

df = pd.DataFrame({
    "temperature_c": np.clip(temperature, 40, 130),
    "vibration_mm_s": np.clip(vibration, 0.5, 13),
    "pressure_bar": np.clip(pressure, 40, 180),
    "load_percent": np.clip(load, 20, 100),
    "power_kw": np.clip(power, 15, 110),
    "failure": failure,
})

root = Path(__file__).resolve().parent
out = root / "data" / "machine_sensor_history.csv"
out.parent.mkdir(exist_ok=True)
out.write_text(df.to_csv(index=False), encoding="utf-8")
print(f"Generated {len(df)} synthetic sensor rows at {out}")
