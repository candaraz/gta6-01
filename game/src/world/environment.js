// environment.js — golden-hour sky dome, animated ocean, sunset lighting, fog.
// One directional sun + hemisphere bounce + ACES tone mapping for a rich, cinematic look.
import * as THREE from 'three';

const SKY_VERT = `
varying vec3 vWorldPos;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const SKY_FRAG = `
uniform vec3 horizonColor;
uniform vec3 zenithColor;
uniform vec3 sunDir;
uniform vec3 sunColor;
varying vec3 vWorldPos;
void main() {
  vec3 d = normalize(vWorldPos);
  float h = clamp(d.y, -0.08, 1.0);
  vec3 col = mix(horizonColor, zenithColor, pow(max(h, 0.0), 0.62));
  float sunAmt = pow(max(dot(d, normalize(sunDir)), 0.0), 180.0);
  float halo = pow(max(dot(d, normalize(sunDir)), 0.0), 7.0);
  col += sunColor * (sunAmt * 1.6 + halo * 0.42);
  // faint warm band right at the horizon
  col += vec3(1.0, 0.55, 0.25) * pow(1.0 - clamp(h, 0.0, 1.0), 6.0) * 0.22;
  gl_FragColor = vec4(col, 1.0);
}`;

const OCEAN_VERT = `
uniform float uTime;
varying vec3 vPos;
varying vec3 vNormal;
void main() {
  vec3 p = position;
  float w1 = sin(p.x * 0.055 + uTime * 1.1) * 0.55;
  float w2 = cos(p.z * 0.045 + uTime * 0.8) * 0.45;
  float w3 = sin((p.x + p.z) * 0.03 + uTime * 0.5) * 0.35;
  p.y += w1 + w2 + w3;
  vPos = p;
  vNormal = normalize(vec3(-cos(p.x * 0.055 + uTime * 1.1) * 0.05, 1.0, -cos(p.z * 0.045 + uTime * 0.8) * 0.05));
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

const OCEAN_FRAG = `
uniform float uTime;
uniform vec3 sunDir;
varying vec3 vPos;
varying vec3 vNormal;
void main() {
  vec3 deep = vec3(0.02, 0.28, 0.42);
  vec3 shallow = vec3(0.10, 0.62, 0.66);
  vec3 n = normalize(vNormal);
  float shimmer = pow(max(dot(reflect(-normalize(sunDir), n), vec3(0.0, 0.0, 1.0)), 0.0), 0.0);
  float sparkle = sin(vPos.x * 0.9 + uTime * 2.2) * sin(vPos.z * 0.8 - uTime * 1.7);
  vec3 col = mix(deep, shallow, 0.35 + 0.3 * sin(vPos.x * 0.02 + uTime * 0.3));
  // sunset glitter path toward the sun
  vec3 viewDir = normalize(vec3(0.0, 0.35, 1.0));
  float spec = pow(max(dot(reflect(-normalize(sunDir), n), viewDir), 0.0), 90.0);
  col += vec3(1.0, 0.62, 0.28) * spec * 1.5;
  col += vec3(1.0, 0.8, 0.5) * max(0.0, sparkle) * 0.05;
  float fres = pow(1.0 - max(dot(n, vec3(0.0, 1.0, 0.0)), 0.0), 2.0);
  col = mix(col, vec3(1.0, 0.55, 0.3), fres * 0.35);
  gl_FragColor = vec4(col, 0.94);
}`;

export class Environment {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.time = 0;
    this.mode = 'golden'; // 'golden' | 'dusk'
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    scene.fog = new THREE.FogExp2(0xf2a35e, 0.0011);

    // Sky dome
    this.skyUniforms = {
      horizonColor: { value: new THREE.Color(0xffb26b) },
      zenithColor: { value: new THREE.Color(0x2a3a6e) },
      sunDir: { value: new THREE.Vector3(-0.72, 0.20, -0.42).normalize() },
      sunColor: { value: new THREE.Color(0xffd9a0) },
    };
    const skyGeo = new THREE.SphereGeometry(1500, 32, 18);
    const skyMat = new THREE.ShaderMaterial({
      uniforms: this.skyUniforms,
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.sky = new THREE.Mesh(skyGeo, skyMat);
    scene.add(this.sky);

    // Sun disc — glowing sprite over the ocean
    const sunCanvas = document.createElement('canvas');
    sunCanvas.width = 256;
    sunCanvas.height = 256;
    const sctx = sunCanvas.getContext('2d');
    const grad = sctx.createRadialGradient(128, 128, 8, 128, 128, 128);
    grad.addColorStop(0, 'rgba(255,240,200,1)');
    grad.addColorStop(0.25, 'rgba(255,200,110,0.95)');
    grad.addColorStop(0.6, 'rgba(255,140,60,0.45)');
    grad.addColorStop(1, 'rgba(255,120,40,0)');
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, 256, 256);
    const sunTex = new THREE.CanvasTexture(sunCanvas);
    sunTex.colorSpace = THREE.SRGBColorSpace;
    this.sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: sunTex, transparent: true, depthWrite: false, fog: false,
    }));
    this.sunSprite.scale.set(320, 320, 1);
    this.sunSprite.position.set(-1150, 190, -620);
    scene.add(this.sunSprite);

    // Warm sunset directional light with shadows
    this.sunLight = new THREE.DirectionalLight(0xffb066, 2.6);
    this.sunLight.position.set(-420, 260, -240);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.camera.left = -380;
    this.sunLight.shadow.camera.right = 380;
    this.sunLight.shadow.camera.top = 380;
    this.sunLight.shadow.camera.bottom = -380;
    this.sunLight.shadow.camera.near = 40;
    this.sunLight.shadow.camera.far = 1400;
    this.sunLight.shadow.bias = -0.0006;
    scene.add(this.sunLight);
    scene.add(this.sunLight.target);

    // Hemisphere bounce: warm sky, sandy ground
    this.hemi = new THREE.HemisphereLight(0xffc98a, 0x8a6a4a, 1.05);
    scene.add(this.hemi);

    // Cool fill from the opposite side so shadows never go black
    this.fill = new THREE.DirectionalLight(0x7ea8ff, 0.5);
    this.fill.position.set(300, 180, 300);
    scene.add(this.fill);

    // Ocean — big animated shader plane to the west and south
    this.oceanUniforms = {
      uTime: { value: 0 },
      sunDir: { value: new THREE.Vector3(-0.72, 0.20, -0.42).normalize() },
    };
    const oceanGeo = new THREE.PlaneGeometry(2600, 2600, 96, 96);
    const oceanMat = new THREE.ShaderMaterial({
      uniforms: this.oceanUniforms,
      vertexShader: OCEAN_VERT,
      fragmentShader: OCEAN_FRAG,
      transparent: true,
    });
    this.ocean = new THREE.Mesh(oceanGeo, oceanMat);
    this.ocean.rotation.x = -Math.PI / 2;
    this.ocean.position.set(-700, -0.4, 0);
    scene.add(this.ocean);

    // Harbor basin water (east docks)
    this.harbor = new THREE.Mesh(
      new THREE.PlaneGeometry(240, 260, 24, 24),
      oceanMat.clone(),
    );
    this.harbor.material.uniforms = this.oceanUniforms;
    this.harbor.rotation.x = -Math.PI / 2;
    this.harbor.position.set(300, -0.35, 60);
    scene.add(this.harbor);
  }

  setMode(mode) {
    this.mode = mode;
    if (mode === 'dusk') {
      this.skyUniforms.horizonColor.value.set(0xe85a7a);
      this.skyUniforms.zenithColor.value.set(0x1a1440);
      this.scene.fog.color.set(0xc96a7a);
      this.sunLight.color.set(0xff7a5c);
      this.sunLight.intensity = 1.9;
      this.hemi.intensity = 0.55;
      this.sunSprite.position.set(-1150, 110, -620);
      this.sunSprite.scale.set(280, 280, 1);
    } else {
      this.skyUniforms.horizonColor.value.set(0xffb26b);
      this.skyUniforms.zenithColor.value.set(0x2a3a6e);
      this.scene.fog.color.set(0xf2a35e);
      this.sunLight.color.set(0xffb066);
      this.sunLight.intensity = 2.6;
      this.hemi.intensity = 0.85;
      this.sunSprite.position.set(-1150, 190, -620);
      this.sunSprite.scale.set(320, 320, 1);
    }
  }

  update(dt) {
    this.time += dt;
    this.oceanUniforms.uTime.value = this.time;
    // slow sun drift for a living sky
    this.sunSprite.material.opacity = 0.92 + Math.sin(this.time * 0.4) * 0.06;
  }
}
