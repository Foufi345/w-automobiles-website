import * as THREE from "three";
import carMeta from "@/lib/car-meta.generated.json";
import { HERO3D_CONFIG, type Hero3DConfig } from "@/lib/hero3d-config";

export interface ArrivalFrameSample {
  /** Time in seconds */
  t: number;
  /** Arc-length distance traveled along the Catmull-Rom path (meters) */
  s: number;
  /** Forward speed v(t) in m/s */
  speedMps: number;
  /** Longitudinal acceleration dv/dt in m/s^2 (negative during braking) */
  longAccelMps2: number;
  /** Lateral (centripetal) acceleration v^2 * curvature in m/s^2 */
  latAccelMps2: number;
  /** World X position on the floor (m) */
  x: number;
  /** World Z position on the floor (m) */
  z: number;
  /** Path tangent heading angle atan2(tx, tz) in radians */
  headingRad: number;
  /** Path signed curvature d(heading)/ds in 1/m */
  curvature: number;
  /** Low-pass filtered front wheel steering angle in radians, clamped to [-0.35, 0.35] */
  steerRad: number;
  /** Cumulative wheel rotation angle in radians (dAngle = ds / wheelRadius, stops when v = 0) */
  wheelAngleRad: number;
  /** Spring-filtered body pitch angle (radians, positive = nose dip, max <= 1 deg, rebound < 0.3 deg) */
  pitchRad: number;
  /** Spring-filtered body roll angle (radians, max <= 0.8 deg) */
  rollRad: number;
  /** Lateral slip velocity component perpendicular to car heading (m/s) */
  lateralSlipMps: number;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const u = Math.max(
    0,
    Math.min(1, (x - edge0) / Math.max(1e-6, edge1 - edge0))
  );
  return u * u * (3 - 2 * u);
}

/**
 * Deterministic 120 Hz Arrival Kinematics & Damped Suspension Spring LUT:
 * - Duration: 3.6 s desktop, 3.2 s mobile.
 * - CatmullRomCurve3 on y = 0 ending at (0, 0, 0) with +20 deg heading (+-3 deg).
 * - Speed: constant v0 for the first 45% of motion, 0.4 s smooth onset into constant
 *   deceleration reaching exact 0 with zero creep, bounce, or overshoot, leaving a
 *   0.48 s settle window inside `duration` so the damped nose rebound (< 0.3 deg)
 *   settles cleanly to 0 deg before `requestAnimationFrame` stops at `t = duration`.
 */
export class ArrivalKinematicsSolver {
  public readonly durationSec: number;
  public readonly dt: number;
  public readonly curve: THREE.CatmullRomCurve3;
  public readonly totalArcLengthM: number;
  public readonly v0Mps: number;
  public readonly brakeDecelMps2: number;
  public readonly finalTangentDeg: number;
  public readonly maxLateralSlipMps: number;
  public readonly maxPitchDeg: number;
  public readonly minReboundPitchDeg: number;
  public readonly samples: ArrivalFrameSample[];

  constructor(durationSec: number, config: Hero3DConfig = HERO3D_CONFIG) {
    const arrCfg = config.arrival;
    this.durationSec = durationSec;
    this.dt = arrCfg.fixedTimeStepSec; // 1 / 120 s

    const pts = arrCfg.pathControlPoints.map(
      ([x, y, z]) => new THREE.Vector3(x, y, z)
    );
    this.curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.5);
    this.curve.arcLengthDivisions = 2000;
    this.curve.updateArcLengths();
    this.totalArcLengthM = this.curve.getLength();

    // High-resolution arc-length table (M = 1600 samples over s in [0, L])
    const M = 1600;
    const arcX = new Float64Array(M + 1);
    const arcZ = new Float64Array(M + 1);
    const arcHeading = new Float64Array(M + 1);
    const arcCurvature = new Float64Array(M + 1);

    for (let i = 0; i <= M; i++) {
      const u = i / M;
      const pt = this.curve.getPointAt(u);
      const tan = this.curve.getTangentAt(u).normalize();
      arcX[i] = pt.x;
      arcZ[i] = pt.z;
      arcHeading[i] = Math.atan2(tan.x, tan.z);
    }

    const dsArc = this.totalArcLengthM / M;
    for (let i = 0; i <= M; i++) {
      if (i === 0) {
        arcCurvature[i] = (arcHeading[1] - arcHeading[0]) / dsArc;
      } else if (i === M) {
        arcCurvature[i] = (arcHeading[M] - arcHeading[M - 1]) / dsArc;
      } else {
        arcCurvature[i] = (arcHeading[i + 1] - arcHeading[i - 1]) / (2 * dsArc);
      }
    }

    this.finalTangentDeg = THREE.MathUtils.radToDeg(arcHeading[M]);

    const sampleCurveAtS = (sMeters: number) => {
      const clampedS = Math.max(0, Math.min(this.totalArcLengthM, sMeters));
      const fIdx = (clampedS / this.totalArcLengthM) * M;
      const i0 = Math.min(M - 1, Math.floor(fIdx));
      const alpha = fIdx - i0;
      return {
        x: arcX[i0] + (arcX[i0 + 1] - arcX[i0]) * alpha,
        z: arcZ[i0] + (arcZ[i0 + 1] - arcZ[i0]) * alpha,
        headingRad:
          arcHeading[i0] + (arcHeading[i0 + 1] - arcHeading[i0]) * alpha,
        curvature:
          arcCurvature[i0] + (arcCurvature[i0 + 1] - arcCurvature[i0]) * alpha,
      };
    };

    // Translational stop time leaves `settleWindowSec` (0.40 s) inside `durationSec`
    // so the single damped spring nose rebound (< 0.3 deg) settles before rAF stops at `t = durationSec`.
    const tWheelStop = Math.max(0.8, durationSec - arrCfg.settleWindowSec);
    const tCruiseEnd = durationSec * arrCfg.cruiseFraction;
    const tConstDecelStart = tCruiseEnd + arrCfg.brakeOnsetSec;

    const evalBrakeShape = (t: number): number => {
      if (t <= tCruiseEnd || t >= tWheelStop) return 0;
      if (t < tConstDecelStart) {
        return smoothstep(tCruiseEnd, tConstDecelStart, t);
      }
      return 1.0;
    };

    const totalSteps = Math.round(durationSec / this.dt);
    const stopStep = Math.round(tWheelStop / this.dt);

    const gArr = new Float64Array(totalSteps + 1);
    const intGArr = new Float64Array(totalSteps + 1);
    for (let k = 0; k <= totalSteps; k++) {
      const t = k * this.dt;
      gArr[k] = k < stopStep ? evalBrakeShape(t) : 0;
      if (k > 0) {
        intGArr[k] = intGArr[k - 1] + 0.5 * (gArr[k - 1] + gArr[k]) * this.dt;
      }
    }

    const totalIntG = intGArr[stopStep];
    const vUnitArr = new Float64Array(totalSteps + 1);
    const sUnitArr = new Float64Array(totalSteps + 1);
    for (let k = 0; k <= totalSteps; k++) {
      vUnitArr[k] =
        k >= stopStep ? 0 : Math.max(0, 1 - intGArr[k] / totalIntG);
      if (k > 0) {
        sUnitArr[k] =
          sUnitArr[k - 1] + 0.5 * (vUnitArr[k - 1] + vUnitArr[k]) * this.dt;
      }
    }

    const totalUnitDist = sUnitArr[stopStep];
    this.v0Mps = this.totalArcLengthM / totalUnitDist;
    this.brakeDecelMps2 = this.v0Mps / totalIntG;

    const wheelbase = carMeta.wheelbase;
    const wheelRadius = carMeta.wheelRadius;
    const maxSteer = arrCfg.maxSteerRad;
    const steerTau = arrCfg.steerFilterTauSec;
    const omega = arrCfg.springOmega; // 9
    const zeta = arrCfg.springZeta; // 0.55

    const maxPitchRad = THREE.MathUtils.degToRad(arrCfg.maxBrakingPitchDeg);
    const kPitch = maxPitchRad / Math.max(0.1, this.brakeDecelMps2);

    let maxAbsLatAccel = 0.01;
    for (let k = 0; k <= stopStep; k++) {
      const s = sUnitArr[k] * this.v0Mps;
      const v = vUnitArr[k] * this.v0Mps;
      const { curvature } = sampleCurveAtS(s);
      const aLat = Math.abs(v * v * curvature);
      if (aLat > maxAbsLatAccel) maxAbsLatAccel = aLat;
    }
    const maxRollRad = THREE.MathUtils.degToRad(arrCfg.maxCorneringRollDeg);
    const kRoll = maxRollRad / maxAbsLatAccel;

    let steerFiltered = 0;
    let pitch = 0;
    let pitchVel = 0;
    let roll = 0;
    let rollVel = 0;
    let maxSlip = 0;
    let peakPitchDeg = 0;
    let minPitchDeg = 0;

    this.samples = new Array<ArrivalFrameSample>(totalSteps + 1);

    for (let k = 0; k <= totalSteps; k++) {
      const t = Number((k * this.dt).toFixed(6));
      const s =
        k >= stopStep
          ? this.totalArcLengthM
          : Math.min(this.totalArcLengthM, sUnitArr[k] * this.v0Mps);
      const speedMps = k >= stopStep ? 0 : vUnitArr[k] * this.v0Mps;
      const longAccelMps2 = -gArr[k] * this.brakeDecelMps2;

      const { x, z, headingRad, curvature } = sampleCurveAtS(s);
      const latAccelMps2 = speedMps * speedMps * curvature;

      const rawSteer = Math.max(
        -maxSteer,
        Math.min(maxSteer, Math.atan(wheelbase * curvature))
      );

      if (k === 0) {
        steerFiltered = rawSteer;
      } else if (k <= stopStep) {
        const alphaSteer = 1 - Math.exp(-this.dt / Math.max(0.01, steerTau));
        steerFiltered += (rawSteer - steerFiltered) * alphaSteer;
      }

      // Exact rolling angle: dAngle = ds / wheelRadius, landing at 0 when s == L
      const wheelAngleRad = (s - this.totalArcLengthM) / wheelRadius;

      const pitchTargetRad = -kPitch * longAccelMps2;
      const rollTargetRad = -kRoll * latAccelMps2;

      if (k > 0) {
        const subSteps = 4;
        const h = this.dt / subSteps;
        for (let sub = 0; sub < subSteps; sub++) {
          const pitchAcc =
            omega * omega * (pitchTargetRad - pitch) -
            2 * zeta * omega * pitchVel;
          pitchVel += pitchAcc * h;
          pitch += pitchVel * h;

          const rollAcc =
            omega * omega * (rollTargetRad - roll) - 2 * zeta * omega * rollVel;
          rollVel += rollAcc * h;
          roll += rollVel * h;
        }
      }

      // Smoothly taper any sub-0.02 deg residual tail in the final 0.08 s so t = duration is exact 0.000
      const endFade =
        k === totalSteps
          ? 0
          : 1 - smoothstep(durationSec - 0.08, durationSec, t);
      const finalPitch = pitch * endFade;
      const finalRoll = roll * endFade;

      const pDeg = THREE.MathUtils.radToDeg(finalPitch);
      if (pDeg > peakPitchDeg) peakPitchDeg = pDeg;
      if (pDeg < minPitchDeg) minPitchDeg = pDeg;

      let lateralSlipMps = 0;
      if (k > 0 && k <= stopStep) {
        const prev = this.samples[k - 1];
        const vx = (x - prev.x) / this.dt;
        const vz = (z - prev.z) / this.dt;
        const latNx = Math.cos(headingRad);
        const latNz = -Math.sin(headingRad);
        lateralSlipMps = Math.abs(vx * latNx + vz * latNz);
        if (lateralSlipMps > maxSlip) maxSlip = lateralSlipMps;
      }

      this.samples[k] = {
        t,
        s,
        speedMps,
        longAccelMps2,
        latAccelMps2,
        x,
        z,
        headingRad,
        curvature,
        steerRad: steerFiltered,
        wheelAngleRad,
        pitchRad: finalPitch,
        rollRad: finalRoll,
        lateralSlipMps,
      };
    }

    this.maxLateralSlipMps = maxSlip;
    this.maxPitchDeg = peakPitchDeg;
    this.minReboundPitchDeg = minPitchDeg;
  }

  /**
   * Pure deterministic lookup & linear interpolation for any time `t >= 0`.
   * For `t >= durationSec`, returns the exact parked final state.
   */
  public evaluate(tSeconds: number): ArrivalFrameSample {
    const maxIdx = this.samples.length - 1;
    if (tSeconds <= 0) return this.samples[0];
    if (tSeconds >= this.durationSec) return this.samples[maxIdx];

    const fIdx = tSeconds / this.dt;
    const i0 = Math.min(maxIdx - 1, Math.floor(fIdx));
    const i1 = i0 + 1;
    const alpha = fIdx - i0;

    const a = this.samples[i0];
    const b = this.samples[i1];
    const lerp = (v0: number, v1: number) => v0 + (v1 - v0) * alpha;

    return {
      t: tSeconds,
      s: lerp(a.s, b.s),
      speedMps: lerp(a.speedMps, b.speedMps),
      longAccelMps2: lerp(a.longAccelMps2, b.longAccelMps2),
      latAccelMps2: lerp(a.latAccelMps2, b.latAccelMps2),
      x: lerp(a.x, b.x),
      z: lerp(a.z, b.z),
      headingRad: lerp(a.headingRad, b.headingRad),
      curvature: lerp(a.curvature, b.curvature),
      steerRad: lerp(a.steerRad, b.steerRad),
      wheelAngleRad: lerp(a.wheelAngleRad, b.wheelAngleRad),
      pitchRad: lerp(a.pitchRad, b.pitchRad),
      rollRad: lerp(a.rollRad, b.rollRad),
      lateralSlipMps: lerp(a.lateralSlipMps, b.lateralSlipMps),
    };
  }
}
