// ============================================================
//  3D-ВИТРИНА РЫЦАРЯ: модель GLB CC0 с patch.gg
//  Animated knight in plate armour (anymove:knight), CC0,
//  https://patch.gg/create/toolbox/assets/anymove:knight
//  Рендерится в canvas панели экипировки поверх 2D-куклы.
//  v2: тень, золотая пыль, световое пятно, покачивание камеры.
// ============================================================

import * as THREE from "./vendor/three/three.module.min.js";
import { GLTFLoader } from "./vendor/three/GLTFLoader.js?v=1";
import { MeshoptDecoder } from "./vendor/three/MeshoptDecoder.js?v=1";

const MODEL_URL = "./assets/models/knight_preview.glb";
const BOW_URL = "./assets/models/bow_preview.glb";

export function initKnight3D(canvas, onReady) {
  if (!canvas || !window.WebGLRenderingContext) { onReady?.(false); return null; }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: false });
  } catch (e) { onReady?.(false); return null; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(canvas.clientWidth || 150, canvas.clientHeight || 240, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0d0a08, 0.055);
  const camera = new THREE.PerspectiveCamera(35, (canvas.clientWidth || 150) / (canvas.clientHeight || 240), 0.1, 100);
  camera.position.set(0, 1.05, 4.2);
  camera.lookAt(0, 0.95, 0);

  // свет: тёплый ключ + холодный контровой (средневековая витрина)
  scene.add(new THREE.HemisphereLight(0xffe2b0, 0x1a1428, 1.1));
  const key = new THREE.DirectionalLight(0xffd9a0, 2.2);
  key.position.set(3, 5, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(512, 512);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x88aaff, 1.6); rim.position.set(-3, 2, -3); scene.add(rim);

  // тёплое световое пятно-«факел» снизу (мерцает в цикле)
  const torch = new THREE.PointLight(0xffa040, 1.4, 6, 1.6);
  torch.position.set(0.6, 0.4, 1.4);
  scene.add(torch);

  // пьедестал (подгоняется под реальный размер модели после загрузки)
  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(1, 1.06, 0.14, 24),
    new THREE.MeshStandardMaterial({ color: 0x3a3229, roughness: 0.9 })
  );
  pedestal.receiveShadow = true;
  scene.add(pedestal);

  // пол: принимает мягкую тень, почти невидим в тумане
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(6, 32),
    new THREE.ShadowMaterial({ opacity: 0.45 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.001;
  floor.receiveShadow = true;
  scene.add(floor);

  // золотая пыль в воздухе (мерцает, дрейфует вверх)
  const DUST = 90;
  const dustPos = new Float32Array(DUST * 3);
  const dustSeed = new Float32Array(DUST);
  for (let i = 0; i < DUST; i++) {
    dustPos[i * 3] = (Math.random() - 0.5) * 4.2;
    dustPos[i * 3 + 1] = Math.random() * 3.2;
    dustPos[i * 3 + 2] = (Math.random() - 0.5) * 3.0;
    dustSeed[i] = Math.random() * Math.PI * 2;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    color: 0xffd98a, size: 0.035, transparent: true, opacity: 0.65,
    sizeAttenuation: true, depthWrite: false,
  }));
  scene.add(dust);

  let mixer = null, clip = null, raf = 0;
  let center = new THREE.Vector3(0, 0.2, 0), dist = 1.2;
  const clock = new THREE.Clock();

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  loader.load(MODEL_URL, (gltf) => {
    const model = gltf.scene;
    model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    scene.add(model);

    // анимации из GLB (Idle / Walk / Attack / Hit ...)
    if (gltf.animations?.length) {
      mixer = new THREE.AnimationMixer(model);
      clip = gltf.animations.find(a => /idle/i.test(a.name)) || gltf.animations[0];
      mixer.clipAction(clip).play();
    }

    // прогнать анимацию на 0 кадров, чтобы скин принял рабочую позу,
    // и только потом мерить bbox — иначе считаем bind-pose и фигура парит
    mixer?.update(0);
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model, true);
    // SkinnedMesh: bbox по текущей (анимированной) позе, не по bind-pose
    model.traverse((o) => {
      if (o.isSkinnedMesh) {
        o.computeBoundingBox();
        const b = o.boundingBox.clone().applyMatrix4(o.matrixWorld);
        box.union(b);
      }
    });
    const size = new THREE.Vector3(); box.getSize(size);
    const c = new THREE.Vector3(); box.getCenter(c);
    const h = Math.max(size.y, 0.2);
    center = c.clone();
    dist = h * 2.4;                       // запас по высоте — фигура в кадре целиком
    pedestal.scale.setScalar(Math.max(size.x, size.z) * 0.8);
    pedestal.scale.y = 1;
    pedestal.position.set(c.x, box.min.y - 0.04, c.z);   // стопы стоят на пьедестале
    floor.position.y = box.min.y - 0.045;

    // ---- лук в руку (Weapon bow, CC0 Kenney mini-forest) ----
    // вешаем на кость левой/правой кисти, если она есть; иначе ставим рядом
    new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load(BOW_URL, (bg) => {
      const bow = bg.scene;
      const bbox = new THREE.Box3().setFromObject(bow);
      const bsize = new THREE.Vector3(); bbox.getSize(bsize);
      const knightH = Math.max(size.y, 0.2);
      // лук примерно по пояс-грудь герою
      const k = (knightH * 0.55) / Math.max(bsize.y, 0.01);
      bow.scale.setScalar(k);

      let hand = null;
      model.traverse((o) => {
        if (!hand && /hand.*(r|l)|.*hand$/i.test(o.name) && o.isBone) hand = o;
      });
      if (hand) {
        bow.position.set(0, 0, 0);
        bow.rotation.set(0, Math.PI / 2, 0);
        hand.add(bow);
      } else {
        // запасной вариант: лук у левого бока
        const bb2 = new THREE.Box3().setFromObject(bow);
        bow.position.set(
          c.x - size.x * 0.42,
          c.y - (bbox.min.y - bb2.min.y) * 0.1,
          c.z + size.z * 0.2,
        );
        bow.rotation.set(0, Math.PI / 2, 0.15);
        scene.add(bow);
      }
    });

    onReady?.(true);
  }, undefined, () => onReady?.(false));

  let angle = 0;
  function loop() {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    if (mixer) mixer.update(dt);
    angle += dt * 0.25;
    // покачивание камеры (дыхание витрины) + мерцание факела
    const bob = Math.sin(t * 0.9) * 0.03;
    camera.position.set(Math.sin(angle) * dist, center.y + dist * 0.18 + bob, Math.cos(angle) * dist);
    camera.lookAt(center);
    torch.intensity = 1.2 + Math.sin(t * 7.3) * 0.18 + Math.sin(t * 11.7) * 0.12;
    // пыль дрейфует вверх и вспыхивает
    const pos = dust.geometry.attributes.position;
    for (let i = 0; i < DUST; i++) {
      let y = pos.getY(i) + dt * 0.12;
      if (y > 3.2) y = 0;
      pos.setY(i, y);
      pos.setX(i, pos.getX(i) + Math.sin(t * 0.7 + dustSeed[i]) * dt * 0.05);
    }
    pos.needsUpdate = true;
    dust.material.opacity = 0.5 + Math.sin(t * 2.1) * 0.15;
    renderer.render(scene, camera);
  }
  loop();

  return {
    /** проиграть другой клип по имени (Attack / Hit / Walk и т.д.) */
    play(name) {
      if (!mixer) return;
      const a = mixer._actions?.[0]?._clip;
      // ищем в загруженных клипах
      const found = (mixer._root?.animations || []).find(c => c.name === name);
      if (found && found !== clip) { clip = found; mixer.clipAction(clip).reset().play(); }
      else if (a) mixer.clipAction(a).reset().play();
    },
    dispose() { cancelAnimationFrame(raf); mixer?.stopAllAction(); renderer.dispose(); },
  };
}
