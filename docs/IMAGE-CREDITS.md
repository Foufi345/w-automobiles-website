# 3D Model & Image Credits

## Active 3D Hero Car Model (`/public/models/hero-car.glb` & `/public/models/hero-car-lite.glb`)

- **Model Title**: **2020 Audi RS7 Sportback**
- **Author**: **Ddiaz Design** (`https://sketchfab.com/ddiaz-design`)
- **Source URL**: `https://sketchfab.com/3d-models/2020-audi-rs7-sportback-61dd9575a8c645558aa912042af0cfc1`
- **Original Input File**: `/public/hero/hero-car-original.glb` (`13.27 MB`, `229,253` triangles)
- **License**: **CC BY-NC-SA 4.0** (`http://creativecommons.org/licenses/by-nc-sa/4.0/`)
- **Required Attribution Text**:
  > "2020 Audi RS7 Sportback" (https://sketchfab.com/3d-models/2020-audi-rs7-sportback-61dd9575a8c645558aa912042af0cfc1) by Ddiaz Design (https://sketchfab.com/ddiaz-design) is licensed under Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (http://creativecommons.org/licenses/by-nc-sa/4.0/). Modifications: rescaled to real-world meters (5.009 m × 2.122 m × 1.426 m), centered at ground contact with wheel bottoms at y = 0, rigged into named wheel/steering/lighting nodes (`car_body`, `steer_FL`, `steer_FR`, `wheel_FL`, `wheel_FR`, `wheel_RL`, `wheel_RR`, `calipers`, `glass`, `headlights`, `drl`, `taillights`), license plate text removed, compressed with 14-bit Draco normals & WebP into `hero-car.glb` (`0.939 MB`) and `hero-car-lite.glb` (`0.526 MB`).
- **Legal Page Placement**: Displayed on `/[locale]/mentions-legales` under the 3D Model Attribution section.

---

## Art-Directed Transparent Hero Posters (`npm run hero:poster`)

- **Files**:
  - `/public/hero/hero-poster-landscape.webp` (`1920 × 1080 px`, `44.2 KB`, transparent RGBA with soft ground shadows)
  - `/public/hero/hero-poster-landscape.avif` (`1920 × 1080 px`, `42.3 KB`, transparent RGBA with soft ground shadows)
  - `/public/hero/hero-poster-portrait.webp` (`1080 × 1920 px`, `23.3 KB`, transparent RGBA with soft ground shadows)
  - `/public/hero/hero-poster-portrait.avif` (`1080 × 1920 px`, `20.8 KB`, transparent RGBA with soft ground shadows)
- **Source**: Rendered directly from our Three.js `HeroScene` (`?poster=1` with `preserveDrawingBuffer: true`, `alpha: true`, soft contact/ambient ground shadows, no background, no text) using the licensed 3D Audi RS7 model above.
