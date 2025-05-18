// glMatrix fonksiyonlarýný kullanmak için:
const mat4 = glMatrix.mat4;
const vec3 = glMatrix.vec3;

// Canvas ve WebGL setup
const canvas = document.getElementById("glCanvas");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const gl = canvas.getContext("webgl");
if (!gl) alert("WebGL is not supported!");
gl.viewport(0, 0, canvas.width, canvas.height);
gl.enable(gl.DEPTH_TEST);
canvas.requestPointerLock = canvas.requestPointerLock || canvas.mozRequestPointerLock;

// Shader helpers
function getShaderSource(id) {
    return document.getElementById(id).textContent.trim();
}

function compileShader(gl, source, type) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error("Shader compile error:", gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

function createProgram(gl, vsId, fsId) {
    const vsSource = getShaderSource(vsId);
    const fsSource = getShaderSource(fsId);
    const vertexShader = compileShader(gl, vsSource, gl.VERTEX_SHADER);
    const fragmentShader = compileShader(gl, fsSource, gl.FRAGMENT_SHADER);
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error("Program link error:", gl.getProgramInfoLog(program));
        return null;
    }
    return program;
}

// Matematiksel yardýmcý fonksiyonlar
function radians(deg) {
    return deg * Math.PI / 180;
}

function normalize(v) {
    const len = Math.hypot(...v);
    return v.map(x => x / len);
}

function add(a, b) {
    return a.map((v, i) => v + b[i]);
}

function subtract(a, b) {
    return a.map((v, i) => v - b[i]);
}

function scale(s, v) {
    return v.map(x => x * s);
}

function cross(a, b) {
    return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0]
    ];
}

// Kamera ve hareket ayarlarý
let eye = vec3.fromValues(0, 0, 8);
let at = vec3.fromValues(0, 0, 0);
let up = vec3.fromValues(0, 1, 0);

let yaw = -90;
let pitch = 0;
const speed = 0.1;
const sensitivity = 0.2;

let front = vec3.fromValues(0, 0, -1);
let keysPressed = {};

function updateFront() {
    front[0] = Math.cos(radians(yaw)) * Math.cos(radians(pitch));
    front[1] = Math.sin(radians(pitch));
    front[2] = Math.sin(radians(yaw)) * Math.cos(radians(pitch));
    vec3.normalize(front, front);
    vec3.add(at, eye, front);
}
updateFront();

const projectionMatrix = mat4.create();
mat4.perspective(projectionMatrix, radians(45), canvas.width / canvas.height, 0.1, 100);

let viewMatrix = mat4.create();
function updateViewMatrix() {
    mat4.lookAt(viewMatrix, eye, at, up);
}

window.addEventListener("keydown", e => {
    keysPressed[e.key.toLowerCase()] = true;
});

window.addEventListener("keyup", e => {
    keysPressed[e.key.toLowerCase()] = false;
});

canvas.onclick = () => canvas.requestPointerLock();

document.addEventListener("mousemove", (e) => {
    if (document.pointerLockElement === canvas) {
        yaw += e.movementX * sensitivity * 0.1;
        pitch -= e.movementY * sensitivity * 0.1;
        pitch = Math.max(-89, Math.min(89, pitch));
        updateFront();
    }
});

function handleMovement() {
    let move = vec3.fromValues(0, 0, 0);
    const right = vec3.create();
    vec3.cross(right, front, up);
    vec3.normalize(right, right);

    if (keysPressed['w'] || keysPressed['arrowup']) vec3.scaleAndAdd(move, move, front, speed);
    if (keysPressed['s'] || keysPressed['arrowdown']) vec3.scaleAndAdd(move, move, front, -speed);
    if (keysPressed['a'] || keysPressed['arrowleft']) vec3.scaleAndAdd(move, move, right, -speed);
    if (keysPressed['d'] || keysPressed['arrowright']) vec3.scaleAndAdd(move, move, right, speed);

    vec3.add(eye, eye, move);
    vec3.add(at, eye, front);
}

// Küre oluþturma
function createSphere(radius = 1, latBands = 30, longBands = 30) {
    const vertices = [];
    const indices = [];
    for (let lat = 0; lat <= latBands; ++lat) {
        const theta = lat * Math.PI / latBands;
        const sinTheta = Math.sin(theta);
        const cosTheta = Math.cos(theta);

        for (let lon = 0; lon <= longBands; ++lon) {
            const phi = lon * 2 * Math.PI / longBands;
            const sinPhi = Math.sin(phi);
            const cosPhi = Math.cos(phi);

            vertices.push(radius * cosPhi * sinTheta);
            vertices.push(radius * cosTheta);
            vertices.push(radius * sinPhi * sinTheta);
        }
    }
    for (let lat = 0; lat < latBands; ++lat) {
        for (let lon = 0; lon < longBands; ++lon) {
            const first = lat * (longBands + 1) + lon;
            const second = first + longBands + 1;
            indices.push(first, second, first + 1);
            indices.push(second, second + 1, first + 1);
        }
    }
    return {
        vertices: new Float32Array(vertices),
        indices: new Uint16Array(indices)
    };
}

const sphereData = createSphere();

const vertexBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
gl.bufferData(gl.ARRAY_BUFFER, sphereData.vertices, gl.STATIC_DRAW);

const indexBuffer = gl.createBuffer();
gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, sphereData.indices, gl.STATIC_DRAW);

const program = createProgram(gl, "vertex-shader", "fragment-shader");
gl.useProgram(program);

const a_Position = gl.getAttribLocation(program, "a_Position");
const u_Model = gl.getUniformLocation(program, "u_Model");
const u_View = gl.getUniformLocation(program, "u_View");
const u_Projection = gl.getUniformLocation(program, "u_Projection");
const u_Color = gl.getUniformLocation(program, "u_Color");

gl.enableVertexAttribArray(a_Position);
gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, 0, 0);

function drawSphere(modelMatrix, color) {
    gl.uniformMatrix4fv(u_Model, false, modelMatrix);
    gl.uniformMatrix4fv(u_View, false, viewMatrix);
    gl.uniformMatrix4fv(u_Projection, false, projectionMatrix);
    gl.uniform4fv(u_Color, color);
    gl.drawElements(gl.TRIANGLES, sphereData.indices.length, gl.UNSIGNED_SHORT, 0);
}

let angle = 0;
function render() {
    handleMovement();
    updateViewMatrix();

    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    angle += 0.5;
    const earthAngleRad = radians(angle);
    const earthX = 2 * Math.cos(earthAngleRad);
    const earthZ = 2 * Math.sin(earthAngleRad);

    const sunModel = mat4.create();
    mat4.translate(sunModel, sunModel, [0, 0, 0]);
    mat4.scale(sunModel, sunModel, [0.5, 0.5, 0.5]);
    drawSphere(sunModel, [1.0, 0.6, 0.0, 1.0]);

    const earthModel = mat4.create();
    mat4.translate(earthModel, earthModel, [earthX, 0, earthZ]);
    mat4.scale(earthModel, earthModel, [0.25, 0.25, 0.25]);
    drawSphere(earthModel, [0.1, 0.2, 0.8, 1.0]);

    const moonAngleRad = radians(angle * 4);
    const moonX = earthX + 0.75 * Math.cos(moonAngleRad);
    const moonZ = earthZ + 0.75 * Math.sin(moonAngleRad);

    const moonModel = mat4.create();
    mat4.translate(moonModel, moonModel, [moonX, 0, moonZ]);
    mat4.scale(moonModel, moonModel, [0.15, 0.15, 0.15]);
    drawSphere(moonModel, [1.0, 1.0, 0.6, 1.0]);

    requestAnimationFrame(render);
}

render();
