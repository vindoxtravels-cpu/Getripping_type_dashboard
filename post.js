/* Film looks (WebGL2): one full-frame pass that turns the finished picture into a print or screen style.
 * Modes: 1-bit ordered dither, CMYK-style halftone dots, risograph overprint, pixel mosaic, thermal camera,
 * duotone and X-ray. Written for Reel Studio; the looks are inspired by the film styles in Lemo-Opuscar
 * (https://github.com/lemomo-ai/lemo-opuscar), but no code from it is used here.
 */
(() => {
  "use strict";
  const VS = `#version 300 es
in vec2 p; out vec2 uv; void main(){ uv = p*.5+.5; gl_Position = vec4(p,0,1); }`;
  const FS = `#version 300 es
precision highp float;
in vec2 uv; out vec4 o;
uniform sampler2D src;
uniform vec2 res;
uniform float mode, frame, inv;
uniform vec3 inkA, inkB, paper;
float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
float lum(vec3 c){ return dot(c, vec3(.299,.587,.114)); }
float bayer8(ivec2 p){
  int x = p.x & 7, y = p.y & 7, xy = x ^ y;
  int v = ((xy & 1) << 5) | ((y & 1) << 4) | ((xy & 2) << 2) | ((y & 2) << 1) | ((xy & 4) >> 1) | ((y & 4) >> 2);
  return (float(v) + .5) / 64.;
}
vec3 heat(float l){
  vec3 c = mix(vec3(0., 0., .12), vec3(.1, 0., .6), smoothstep(0., .25, l));
  c = mix(c, vec3(.8, 0., .5), smoothstep(.25, .5, l));
  c = mix(c, vec3(1., .5, 0.), smoothstep(.5, .7, l));
  c = mix(c, vec3(1., .95, .2), smoothstep(.7, .88, l));
  return mix(c, vec3(1.), smoothstep(.88, 1., l));
}
void main(){
  vec2 px = gl_FragCoord.xy;
  vec3 c = texture(src, uv).rgb;
  float l = lum(c);
  vec3 outc = c;
  if (mode < 1.5) {                       // 1-bit ordered dither, chunky 2px dots, boiling slightly
    float t = bayer8(ivec2(floor(px / 2.0)) + ivec2(int(mod(frame, 2.0)) * 3, 0));
    float lc = clamp((l - .5) * 1.3 + .5, 0., 1.);
    outc = lc > t ? inkB : inkA;
  } else if (mode < 2.5) {                // halftone dots on a 45 degree screen
    float s = 9.0, a = .7854, ca = cos(a), sa = sin(a);
    mat2 R = mat2(ca, -sa, sa, ca);
    vec2 P = R * px, cell = floor(P / s), ctr = (cell + .5) * s;
    vec2 back = transpose(R) * ctr;
    vec3 cc = texture(src, back / res).rgb;
    float cov = inv > .5 ? lum(cc) : 1. - lum(cc);
    float r = s * .78 * sqrt(clamp(cov * 1.15, 0., 1.));
    float m = smoothstep(r + .9, r - .9, length(P - ctr));
    outc = mix(inkA, mix(inkB, cc, .35), m);
  } else if (mode < 3.5) {                // risograph: two ink plates, misregistered, on grainy paper
    float g = (h(floor(px * .7) + frame * .01) - .5);
    float d1 = inv > .5 ? l : 1. - l;
    vec3 c2 = texture(src, uv + vec2(4., 3.) / res).rgb;
    float d2 = inv > .5 ? lum(c2) : 1. - lum(c2);
    float a1 = smoothstep(.3, .7, d1 + g * .4);
    float a2 = smoothstep(.3, .7, clamp(d2 * 1.1, 0., 1.) + g * .4);
    outc = paper * mix(vec3(1.), inkA, a1) * mix(vec3(1.), inkB, a2 * .85);
    outc *= .94 + h(px + frame) * .08;
  } else if (mode < 4.5) {                // pixel mosaic with a small palette
    vec2 q = (floor(px / 10.0) + .5) * 10.0;
    vec3 cc = texture(src, q / res).rgb;
    outc = floor(cc * 5. + .5) / 5.;
  } else if (mode < 5.5) {                // thermal camera
    outc = heat(clamp(l * 1.15, 0., 1.)) * (.94 + h(px + frame) * .06);
  } else if (mode < 6.5) {                // duotone
    outc = mix(inkA, inkB, smoothstep(.08, .92, l)) * (.95 + h(px + frame * 3.) * .06);
  } else {                                // X-ray: inverted, blue-white, with glowing edges
    vec2 e = 1.0 / res;
    float gx = lum(texture(src, uv + vec2(e.x, 0.)).rgb) - lum(texture(src, uv - vec2(e.x, 0.)).rgb);
    float gy = lum(texture(src, uv + vec2(0., e.y)).rgb) - lum(texture(src, uv - vec2(0., e.y)).rgb);
    float edge = clamp(length(vec2(gx, gy)) * 3., 0., 1.);
    float v = inv > .5 ? l : 1. - l;
    outc = vec3(.45, .8, 1.) * v * 1.1 + vec3(.8, .95, 1.) * edge;
  }
  o = vec4(clamp(outc, 0., 1.), 1.);
}`;
  const MODES = {
    dither: 1,
    halftone: 2,
    riso: 3,
    pixel: 4,
    thermal: 5,
    duotone: 6,
    xray: 7,
  };

  function make(cv) {
    const gl = cv.getContext("webgl2", {
      preserveDrawingBuffer: true,
      antialias: false,
      alpha: false,
    });
    if (!gl) throw new Error("WebGL2 is not available");
    const sh = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
        throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.bindAttribLocation(prog, 0, "p");
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
      throw new Error(gl.getProgramInfoLog(prog));
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    [
      [gl.TEXTURE_MIN_FILTER, gl.LINEAR],
      [gl.TEXTURE_MAG_FILTER, gl.LINEAR],
      [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE],
      [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE],
    ].forEach(([k, v]) => gl.texParameteri(gl.TEXTURE_2D, k, v));
    const U = (n) => gl.getUniformLocation(prog, n);
    return {
      /** src: the finished frame (a canvas); mode: a name from MODES; inks are [r,g,b] in 0..1 */
      render(src, mode, frame, o) {
        gl.useProgram(prog);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA8,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          src,
        );
        gl.uniform1i(U("src"), 0);
        gl.uniform2f(U("res"), cv.width, cv.height);
        gl.uniform1f(U("mode"), MODES[mode] || 0);
        gl.uniform1f(U("frame"), frame);
        gl.uniform1f(U("inv"), o.dark ? 1 : 0);
        gl.uniform3fv(U("inkA"), o.inkA);
        gl.uniform3fv(U("inkB"), o.inkB);
        gl.uniform3fv(U("paper"), o.paper);
        gl.viewport(0, 0, cv.width, cv.height);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      },
    };
  }
  function supported() {
    try {
      return !!document.createElement("canvas").getContext("webgl2");
    } catch (e) {
      return false;
    }
  }
  window.FilmPost = { make, supported, MODES: Object.keys(MODES) };
})();
