import * as THREE from "three";

// Surface variation is illustrative, never a second data channel.
export function celestialSurface() {
  const material = new THREE.MeshStandardMaterial({
    roughness: 0.88,
    metalness: 0.04,
  });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader =
      `varying vec3 vSurface;\n${shader.vertexShader}`.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvSurface = position;",
      );
    shader.fragmentShader = `varying vec3 vSurface;
      float surfaceHash(vec3 p) {
        p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }
      float surfaceNoise(vec3 p) {
        vec3 cell = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(surfaceHash(cell), surfaceHash(cell + vec3(1,0,0)), f.x),
                       mix(surfaceHash(cell + vec3(0,1,0)), surfaceHash(cell + vec3(1,1,0)), f.x), f.y),
                   mix(mix(surfaceHash(cell + vec3(0,0,1)), surfaceHash(cell + vec3(1,0,1)), f.x),
                       mix(surfaceHash(cell + vec3(0,1,1)), surfaceHash(cell + vec3(1,1,1)), f.x), f.y), f.z);
      }
      ${shader.fragmentShader}`.replace(
      "#include <color_fragment>",
      `#include <color_fragment>
       vec3 p = normalize(vSurface);
       float terrain = surfaceNoise(p * 4.0) * 0.6 + surfaceNoise(p * 11.0) * 0.28 + surfaceNoise(p * 28.0) * 0.12;
       diffuseColor.rgb *= mix(0.65, 1.12, smoothstep(0.25, 0.75, terrain));
      `,
    );
  };
  material.customProgramCacheKey = () => "history-forge-celestial-v1";
  return material;
}

export function celestialAtmosphere() {
  return new THREE.ShaderMaterial({
    vertexShader: `
      varying vec3 vRimNormal;
      varying vec3 vRimColor;
      void main() {
        vRimNormal = normalize(normalMatrix * mat3(instanceMatrix) * normal);
        vRimColor = instanceColor;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      varying vec3 vRimNormal;
      varying vec3 vRimColor;
      void main() {
        float rim = pow(1.0 - abs(normalize(vRimNormal).z), 3.0);
        gl_FragColor = vec4(vRimColor, rim * 0.3);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}
