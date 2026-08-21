# System Specification: GPS Fitness Tracking Architecture & Engine

This document provides a structured, machine-readable specification detailing how activity tracking applications (e.g., Strava, Nike Run Club) capture, process, calculate, and store spatial telemetry data during running activities. It serves as a blueprint for AI agents and engineering systems building or processing run-tracking pipelines.

---

## 1. System Input Requirements (Telemetry Vectors)

An operational tracker requires a stream of raw telemetry samples ingested from hardware sensors at a target polling rate of **1 Hz** (1 sample/second).

### 1.1 Field-Level Specifications
| Parameter Field | Data Type | Units / Format | Description | Required / Optional |
| :--- | :--- | :--- | :--- | :--- |
| `timestamp` | ISO-8601 String / Epoch | UTC Seconds / MS | Exact capture timestamp | **Required** |
| `latitude` | Float (Double) | Decimal Degrees ($\pm 90.0$) | WGS-84 coordinate system latitude | **Required** |
| `longitude` | Float (Double) | Decimal Degrees ($\pm 180.0$) | WGS-84 coordinate system longitude | **Required** |
| `altitude` | Float | Meters (m) | Elevation above sea level | **Optional** |
| `horizontal_accuracy` | Float | Meters (m) | Radius of 68% confidence region | **Required** |
| `vertical_accuracy` | Float | Meters (m) | Elevation error confidence radius | Optional |
| `speed` | Float | Meters/sec ($	ext{m/s}$) | Instantaneous GPS-reported velocity | Optional |
| `heading` | Float | Degrees ($0^\circ-360^\circ$) | Direction of travel relative to true north | Optional |
| `step_count` | Integer | Absolute Count | Cumulative step count from pedometer | Optional |
| `heart_rate` | Integer | BPM | Pulse rate from optical sensor or strap | Optional |

---

## 2. Signal Processing & Ingestion Pipeline

```
 [ Raw GPS Stream ] ──► [ Quality Gate Filter ] ──► [ Kalman Smoothing ] ──► [ Auto-Pause Detection ] ──► [ Clean Telemetry Stream ]
```

### 2.1 Quality Gate Filtering
Discard incoming samples prior to processing if any of the following threshold violations occur:
1. `horizontal_accuracy > 20.0 meters` (High-noise drop)
2. Calculated implied velocity between consecutive points > $12.0	ext{ m/s}$ ($~43.2	ext{ km/h}$, human running upper physical threshold)
3. Duplicate or out-of-order `timestamp`

### 2.2 Signal Smoothing (Kalman Filter State-Space Model)
To eliminate GPS multipath interference, model coordinates using a continuous position-velocity state vector:

$$x_k = egin{bmatrix} lat_k & lon_k & v_{lat,k} & v_{lon,k} \end{bmatrix}^T$$

1. **State Prediction:**
   $$\hat{x}_k^- = F \hat{x}_{k-1}$$
   $$P_k^- = F P_{k-1} F^T + Q$$
   *Where $F$ is the state transition model over interval $\Delta t$, $P$ is state covariance, and $Q$ is process noise covariance.*

2. **Measurement Update:**
   $$K_k = P_k^- H^T (H P_k^- H^T + R)^{-1}$$
   $$\hat{x}_k = \hat{x}_k^- + K_k (z_k - H \hat{x}_k^-)$$
   $$P_k = (I - K_k H) P_k^-$$
   *Where $z_k = [lat_{raw}, lon_{raw}]^T$, $H$ is the observation model, $R$ is measurement error covariance scaling with `horizontal_accuracy`.*

---

## 3. Mathematical Models & Metric Calculation

### 3.1 Haversine Distance Formula
Given two consecutive valid coordinates $P_1(lat_1, lon_1)$ and $P_2(lat_2, lon_2)$ converted to radians:

$$\Delta\phi = 	ext{radians}(lat_2 - lat_1)$$
$$\Delta\lambda = 	ext{radians}(lon_2 - lon_1)$$
$$a = \sin^2\left(rac{\Delta\phi}{2}ight) + \cos(	ext{radians}(lat_1)) \cdot \cos(	ext{radians}(lat_2)) \cdot \sin^2\left(rac{\Delta\lambda}{2}ight)$$
$$c = 2 \cdot 	ext{atan2}\left(\sqrt{a}, \sqrt{1 - a}ight)$$
$$d = R_E \cdot c$$

*Where mean Earth radius $R_E = 6,371,000	ext{ meters}$.*

### 3.2 Pace Derivation
1. **Instantaneous / Rolling Pace:**
   $$	ext{Pace}_{	ext{rolling}} = rac{T_{	ext{window}}}{\sum_{i \in 	ext{window}} d_i}$$
   *Standard rolling window duration $T_{	ext{window}} = 15	ext{ seconds}$.*
2. **Formatted Split Pace ($	ext{min/km}$ or $	ext{min/mile}$):**
   $$	ext{Pace}_{	ext{sec\_per\_unit}} = rac{\Delta t_{	ext{unit}}}{D_{	ext{unit}}}$$
   $$	ext{Minutes} = \lfloor 	ext{Pace}_{	ext{sec\_per\_unit}} / 60 floor, \quad 	ext{Seconds} = 	ext{Pace}_{	ext{sec\_per\_unit}} \pmod{60}$$

### 3.3 Auto-Pause Logic Criteria
Trigger `PAUSE` state if and only if both conditions are met for $t_{	ext{threshold}} \ge 3.0	ext{ seconds}$:
1. Rolling average speed $v_{	ext{rolling}} < 0.5	ext{ m/s}$ ($1.8	ext{ km/h}$)
2. Accelerometer variance $\sigma^2_{	ext{accel}} < 0.05	ext{ m/s}^2$ over the same window

---

## 4. Route Optimization & Map Matching

### 4.1 Path Simplification (Ramer-Douglas-Peucker Algorithm)
Compress polyline arrays for rendering efficiency while preserving geographic topological shape:

1. Identify line segment connecting start point $P_1$ and end point $P_N$.
2. Find point $P_k$ at maximum perpendicular distance $\epsilon_{max}$ from segment $P_1P_N$.
3. If $\epsilon_{max} > \epsilon_{	ext{threshold}}$ (standard threshold $pprox 3.0	ext{ meters}$):
   - Recursively simplify segment $P_1 \dots P_k$
   - Recursively simplify segment $P_k \dots P_N$
4. Else: Discard all intermediate points between $P_1$ and $P_N$.

### 4.2 Elevation Correction
Cross-reference raw `altitude` vectors against a Digital Elevation Model (DEM) raster grid (e.g., USGS 1/3 arc-second or SRTM 30m):

$$Alt_{	ext{corrected}}(i) = 	ext{BilinearInterpolation}(	ext{DEM}, lat_i, lon_i)$$

$$	ext{Total Gain} = \sum_{i=1}^{N-1} \max\left(0, Alt_{	ext{corrected}}(i+1) - Alt_{	ext{corrected}}(i)ight) \quad 	ext{where } \Delta Alt > 1.5	ext{m threshold}$$

---

## 5. Storage Schema & Data Interchange

### 5.1 Relational Spatial Schema (PostgreSQL / PostGIS)

```sql
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE activities (
    activity_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    activity_type VARCHAR(50) DEFAULT 'running',
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    total_distance_meters NUMERIC(10, 2) NOT NULL,
    moving_time_seconds INT NOT NULL,
    elapsed_time_seconds INT NOT NULL,
    elevation_gain_meters NUMERIC(8, 2),
    avg_pace_sec_per_km NUMERIC(6, 2),
    summary_polyline TEXT, -- Encoded Google Polyline String
    route_geom GEOMETRY(LineStringM, 4326), -- Trajectory with timestamps (M dimension)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activities_user_id ON activities(user_id);
CREATE INDEX idx_activities_route_geom ON activities USING GIST(route_geom);
```

### 5.2 File Export Specifications
AI systems must support conversion to standard XML / Binary payloads:
* **GPX (GPS Exchange Format):** XML format storing `<trkpt lat="..." lon="...">` with `<time>` and `<ele>`.
* **FIT (Flexible and Interoperable Data Transfer):** Garmin binary format containing tightly packed message structures for low-bandwidth devices.

---

## 6. Required Hardware & Software APIs for AI Execution

| Category | Component / API | Functional Responsibility |
| :--- | :--- | :--- |
| **Location Access** | Apple CoreLocation / Android FusedLocationProviderClient | Raw hardware satellite stream access |
| **Geospatial Processing** | `Shapely`, `Geopy`, `Turf.js`, or `PostGIS` | Geometry construction, distance matrix, spatial indexing |
| **Numeric Processing** | `NumPy`, `SciPy` | Matrix algebra for Kalman filtering & signal processing |
| **Map Matching / DEM** | Mapbox Map Matching API, Open-Elevation API | Snap trajectories to road nets and resolve true elevation |
| **Data Encoding** | `polyline` string encoder | Convert coordinate arrays to compact web rendering strings |

---

## 7. AI Implementation Reference Pseudocode

```python
import numpy as np
from math import radians, sin, cos, sqrt, atan2

class RunTrackerEngine:
    EARTH_RADIUS_M = 6371000.0

    def __init__(self, accuracy_threshold_m=20.0):
        self.accuracy_threshold_m = accuracy_threshold_m
        self.points = []
        self.total_distance_m = 0.0

    @staticmethod
    def haversine_distance(lat1, lon1, lat2, lon2):
        dlat = radians(lat2 - lat1)
        dlon = radians(lon2 - lon1)
        a = sin(dlat / 2)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2)**2
        c = 2 * atan2(sqrt(a), sqrt(1 - a))
        return RunTrackerEngine.EARTH_RADIUS_M * c

    def ingest_telemetry_point(self, lat: float, lon: float, timestamp: float, accuracy: float):
        # 1. Quality Gate Filter
        if accuracy > self.accuracy_threshold_m:
            return False, "Point dropped: Low accuracy"

        new_point = {"lat": lat, "lon": lon, "timestamp": timestamp}

        # 2. Distance Computation
        if self.points:
            prev_point = self.points[-1]
            segment_dist = self.haversine_distance(
                prev_point["lat"], prev_point["lon"], lat, lon
            )
            time_delta = timestamp - prev_point["timestamp"]
            
            # Speed Validation Gate (< 12 m/s)
            if time_delta > 0 and (segment_dist / time_delta) > 12.0:
                return False, "Point dropped: Unrealistic speed spike"

            self.total_distance_m += segment_dist

        self.points.append(new_point)
        return True, "Point ingested"

    def get_summary(self):
        if len(self.points) < 2:
            return {"distance_km": 0.0, "elapsed_sec": 0, "avg_pace_min_km": 0.0}

        elapsed_sec = self.points[-1]["timestamp"] - self.points[0]["timestamp"]
        distance_km = self.total_distance_m / 1000.0
        
        avg_pace_sec_km = (elapsed_sec / distance_km) if distance_km > 0 else 0
        avg_pace_min_km = avg_pace_sec_km / 60.0

        return {
            "distance_km": round(distance_km, 3),
            "elapsed_sec": round(elapsed_sec, 1),
            "avg_pace_min_per_km": round(avg_pace_min_km, 2)
        }
```
