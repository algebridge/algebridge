import * as THREE from "three";

const VERT = `
#include <fog_pars_vertex>
varying vec3 vWorld;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  vec4 mvPosition = viewMatrix * world;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const FRAG = `
#include <fog_pars_fragment>
uniform float uTime;
uniform vec3 uDeep;
uniform vec3 uLight;
varying vec3 vWorld;
void main() {
  float w = sin(vWorld.x * 0.22 + uTime * 0.8) * sin(vWorld.z * 0.17 - uTime * 0.6);
  float w2 = sin((vWorld.x + vWorld.z) * 0.45 + uTime * 1.3);
  float m = smoothstep(0.45, 0.8, w * 0.5 + 0.5 + w2 * 0.22);
  vec3 c = mix(uDeep, uLight, m);
  gl_FragColor = vec4(c, 1.0);
  #include <fog_fragment>
  #include <colorspace_fragment>
}`;

/** Flat cartoon water with slow moving highlights. Call tick() each frame. */
export class WaterMaterial extends THREE.ShaderMaterial {
  constructor(deep: string, light: string) {
    super({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uDeep: { value: new THREE.Color(deep) }, uLight: { value: new THREE.Color(light) } }]),
      vertexShader: VERT,
      fragmentShader: FRAG,
      fog: true,
    });
  }

  tick(dt: number): void {
    this.uniforms.uTime.value += dt;
  }
}
