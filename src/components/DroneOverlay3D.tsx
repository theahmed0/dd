import {useEffect, useRef, useState} from 'react';
import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import type {CameraViewMode, DronePhysicsState} from '../types/drone';

interface DroneOverlay3DProps {
  droneStateRef: React.MutableRefObject<DronePhysicsState>;
  cameraMode: CameraViewMode;
}

export function DroneOverlay3D({droneStateRef, cameraMode}: DroneOverlay3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const cameraModeRef = useRef<CameraViewMode>(cameraMode);
  const [contextLost, setContextLost] = useState(false);

  useEffect(() => {
    cameraModeRef.current = cameraMode;
  }, [cameraMode]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Detect software WebGL once cleanly
    const isSoftwareGl = (() => {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.pointerEvents = 'none';

    container.appendChild(renderer.domElement);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const handleContextRestored = () => {
      setContextLost(false);
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

    const scene = new THREE.Scene();

    // Procedural Studio Environment Map for metallic & lens reflections
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    roomEnv.dispose();
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(
      46,
      (container.clientWidth || window.innerWidth) / (container.clientHeight || window.innerHeight),
      0.1,
      50,
    );
    camera.position.set(0, 1.05, 3.35);
    camera.lookAt(0, -0.05, -0.4);

    // 3-Point Sky-Matched Lighting Rig (warm sunlight key + cool sky/earth hemisphere + rim)
    const keyLight = new THREE.DirectionalLight(0xfff3dd, 2.2);
    keyLight.position.set(4, 7, 3);
    scene.add(keyLight);

    const hemiLight = new THREE.HemisphereLight(0x9bd0ff, 0x3b342b, 1.1);
    scene.add(hemiLight);

    const rimLight = new THREE.DirectionalLight(0x7cdbff, 1.25);
    rimLight.position.set(-4, 2, -5);
    scene.add(rimLight);

    // --- Build 12-Part Composite PBR Quadcopter Drone ---
    const droneGroup = new THREE.Group();
    // Position drone slightly below viewport center so forward horizon stays clear
    droneGroup.position.set(0, -0.28, 0);
    scene.add(droneGroup);

    const geometriesToDispose: THREE.BufferGeometry[] = [];
    const materialsToDispose: THREE.Material[] = [];

    const carbonMat = new THREE.MeshStandardMaterial({
      color: 0x1e2430,
      roughness: 0.42,
      metalness: 0.35,
    });
    const shellMat = new THREE.MeshStandardMaterial({
      color: 0xd4dae3,
      roughness: 0.32,
      metalness: 0.18,
    });
    const brushedMetalMat = new THREE.MeshStandardMaterial({
      color: 0x9aa4b2,
      roughness: 0.2,
      metalness: 0.9,
    });
    const darkTrimMat = new THREE.MeshStandardMaterial({
      color: 0x11151d,
      roughness: 0.72,
      metalness: 0.1,
    });
    const lensMat = new THREE.MeshPhysicalMaterial({
      color: 0x0b1a2b,
      roughness: 0.08,
      metalness: 0.15,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      ior: 1.55,
    });
    const rotorBlurMat = new THREE.MeshStandardMaterial({
      color: 0xdbe5f2,
      transparent: true,
      opacity: 0.22,
      roughness: 0.25,
      metalness: 0.3,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const rearLedGreen = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x10b981,
      emissiveIntensity: 2.2,
      roughness: 0.2,
    });
    const frontLedAmber = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xf59e0b,
      emissiveIntensity: 2.0,
      roughness: 0.2,
    });
    materialsToDispose.push(
      carbonMat,
      shellMat,
      brushedMetalMat,
      darkTrimMat,
      lensMat,
      rotorBlurMat,
      rearLedGreen,
      frontLedAmber,
    );

    // 1. Primary aerodynamic fuselage hull (beveled ExtrudeGeometry)
    const hullShape = new THREE.Shape();
    hullShape.moveTo(0, 0.48);
    hullShape.bezierCurveTo(0.18, 0.44, 0.22, 0.15, 0.19, -0.25);
    hullShape.bezierCurveTo(0.16, -0.45, 0.08, -0.52, 0, -0.52);
    hullShape.bezierCurveTo(-0.08, -0.52, -0.16, -0.45, -0.19, -0.25);
    hullShape.bezierCurveTo(-0.22, 0.15, -0.18, 0.44, 0, 0.48);

    const hullGeo = new THREE.ExtrudeGeometry(hullShape, {
      depth: 0.11,
      bevelEnabled: true,
      bevelThickness: 0.035,
      bevelSize: 0.025,
      bevelSegments: 3,
    });
    hullGeo.rotateX(Math.PI / 2);
    hullGeo.center();
    geometriesToDispose.push(hullGeo);

    const hullMesh = new THREE.Mesh(hullGeo, shellMat);
    droneGroup.add(hullMesh);

    // 2. Top battery spine module
    const batteryGeo = new THREE.BoxGeometry(0.18, 0.09, 0.46);
    geometriesToDispose.push(batteryGeo);
    const batteryMesh = new THREE.Mesh(batteryGeo, darkTrimMat);
    batteryMesh.position.set(0, 0.09, 0.04);
    droneGroup.add(batteryMesh);

    // 3. Rear status LED bar on battery
    const rearLedGeo = new THREE.BoxGeometry(0.12, 0.024, 0.03);
    geometriesToDispose.push(rearLedGeo);
    const rearLedMesh = new THREE.Mesh(rearLedGeo, rearLedGreen);
    rearLedMesh.position.set(0, 0.1, 0.275);
    droneGroup.add(rearLedMesh);

    // 4. Lower carbon belly plate
    const bellyGeo = new THREE.BoxGeometry(0.24, 0.035, 0.62);
    geometriesToDispose.push(bellyGeo);
    const bellyMesh = new THREE.Mesh(bellyGeo, carbonMat);
    bellyMesh.position.set(0, -0.075, 0);
    droneGroup.add(bellyMesh);

    // 5. Front 3-axis camera gimbal pod + optical lens
    const gimbalGroup = new THREE.Group();
    gimbalGroup.position.set(0, -0.11, -0.34);
    const gimbalHousingGeo = new THREE.SphereGeometry(0.075, 16, 14);
    const lensBarrelGeo = new THREE.CylinderGeometry(0.036, 0.04, 0.055, 16);
    lensBarrelGeo.rotateX(Math.PI / 2);
    const lensGlassGeo = new THREE.SphereGeometry(0.032, 14, 12);
    geometriesToDispose.push(gimbalHousingGeo, lensBarrelGeo, lensGlassGeo);

    const gimbalHousing = new THREE.Mesh(gimbalHousingGeo, darkTrimMat);
    const lensBarrel = new THREE.Mesh(lensBarrelGeo, brushedMetalMat);
    lensBarrel.position.set(0, 0, -0.055);
    const lensGlass = new THREE.Mesh(lensGlassGeo, lensMat);
    lensGlass.position.set(0, 0, -0.08);
    gimbalGroup.add(gimbalHousing, lensBarrel, lensGlass);
    droneGroup.add(gimbalGroup);

    // 6. Landing skids (left & right)
    const skidGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.56, 8);
    skidGeo.rotateX(Math.PI / 2);
    const strutGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.12, 8);
    geometriesToDispose.push(skidGeo, strutGeo);

    for (const side of [-1, 1]) {
      const skid = new THREE.Mesh(skidGeo, carbonMat);
      skid.position.set(side * 0.18, -0.175, 0.02);
      droneGroup.add(skid);

      for (const zOff of [-0.16, 0.18]) {
        const strut = new THREE.Mesh(strutGeo, carbonMat);
        strut.position.set(side * 0.15, -0.125, zOff);
        strut.rotation.z = side * 0.35;
        droneGroup.add(strut);
      }
    }

    // 7-12. Four arms, motor bells, navigation LEDs, and spinning rotor assemblies
    const rotorGroups: THREE.Group[] = [];
    const armConfigs = [
      {x: -0.52, z: -0.44, dir: 1, front: true},
      {x: 0.52, z: -0.44, dir: -1, front: true},
      {x: -0.48, z: 0.44, dir: -1, front: false},
      {x: 0.48, z: 0.44, dir: 1, front: false},
    ];

    const motorBellGeo = new THREE.CylinderGeometry(0.052, 0.056, 0.065, 16);
    const motorCapGeo = new THREE.CylinderGeometry(0.02, 0.032, 0.03, 12);
    const bladeGeo = new THREE.BoxGeometry(0.56, 0.008, 0.042);
    const blurDiscGeo = new THREE.RingGeometry(0.055, 0.285, 28);
    blurDiscGeo.rotateX(-Math.PI / 2);
    const navLedGeo = new THREE.SphereGeometry(0.018, 10, 10);
    geometriesToDispose.push(motorBellGeo, motorCapGeo, bladeGeo, blurDiscGeo, navLedGeo);

    for (const cfg of armConfigs) {
      // Carbon arm tube connecting fuselage to motor mount
      const startPt = new THREE.Vector3(cfg.x * 0.22, 0.0, cfg.z * 0.28);
      const endPt = new THREE.Vector3(cfg.x, 0.04, cfg.z);
      const armCurve = new THREE.LineCurve3(startPt, endPt);
      const armGeo = new THREE.TubeGeometry(armCurve, 4, 0.024, 10, false);
      geometriesToDispose.push(armGeo);
      const armMesh = new THREE.Mesh(armGeo, carbonMat);
      droneGroup.add(armMesh);

      // Motor bell
      const motorBell = new THREE.Mesh(motorBellGeo, brushedMetalMat);
      motorBell.position.set(cfg.x, 0.055, cfg.z);
      droneGroup.add(motorBell);

      // Navigation LED under each motor
      const navLed = new THREE.Mesh(navLedGeo, cfg.front ? frontLedAmber : rearLedGreen);
      navLed.position.set(cfg.x, 0.01, cfg.z);
      droneGroup.add(navLed);

      // Rotor assembly
      const rotor = new THREE.Group();
      rotor.position.set(cfg.x, 0.095, cfg.z);
      rotor.userData.dir = cfg.dir;

      const cap = new THREE.Mesh(motorCapGeo, brushedMetalMat);
      const blade = new THREE.Mesh(bladeGeo, darkTrimMat);
      const blurDisc = new THREE.Mesh(blurDiscGeo, rotorBlurMat);
      rotor.add(cap, blade, blurDisc);

      droneGroup.add(rotor);
      rotorGroups.push(rotor);
    }

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    let frameId = 0;
    let disposed = false;
    let lastTime = performance.now();
    let elapsed = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    const tick = () => {
      if (disposed) return;
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      elapsed += dt;

      if (cameraModeRef.current === 'chase') {
        const st = droneStateRef.current;
        // Drone tilts forward (-X rotation) when flying forward, banks (-Z rotation) when strafing/turning
        const targetPitchRad = THREE.MathUtils.degToRad(-st.pitchDeg * 0.85);
        const targetRollRad = THREE.MathUtils.degToRad(-st.rollDeg * 0.95);
        const targetYawSway = THREE.MathUtils.degToRad(-st.yawRateDegS * 0.08);

        const dampAlpha = 1 - Math.exp(-9 * dt);
        droneGroup.rotation.x += (targetPitchRad - droneGroup.rotation.x) * dampAlpha;
        droneGroup.rotation.z += (targetRollRad - droneGroup.rotation.z) * dampAlpha;
        droneGroup.rotation.y += (targetYawSway - droneGroup.rotation.y) * dampAlpha;

        // Subtle aerodynamic hover oscillation
        droneGroup.position.y = -0.28 + Math.sin(elapsed * 2.6) * 0.018;
        droneGroup.position.x = Math.sin(elapsed * 1.4) * 0.012;

        // Spin propellers proportional to real throttle
        const spinRad = (24 + st.throttleNormalized * 44) * dt;
        for (let i = 0; i < rotorGroups.length; i++) {
          const r = rotorGroups[i];
          r.rotation.y += spinRad * (r.userData.dir as number);
        }

        // Keep gimbal camera level relative to ground tilt
        gimbalGroup.rotation.x = THREE.MathUtils.degToRad(
          THREE.MathUtils.clamp((st.tiltDeg - 82) * 0.35, -35, 10),
        );

        renderer.render(scene, camera);
      }

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    if (isSoftwareGl) {
      afterDraw(tick);
    } else {
      frameId = requestAnimationFrame(tick);
    }

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);

      for (const g of geometriesToDispose) g.dispose();
      for (const m of materialsToDispose) m.dispose();
      envTarget.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [droneStateRef]);

  if (contextLost) return null;

  return (
    <div
      ref={mountRef}
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 z-10 transition-opacity duration-200 ${
        cameraMode === 'chase' ? 'opacity-100' : 'opacity-0'
      }`}
    />
  );
}
