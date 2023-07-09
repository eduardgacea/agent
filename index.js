'use strict';

// all points should be 2D vectors of the form [x, y]

const root = document.getElementById('root');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;

const positionDisplay = document.getElementById('position');
const velocityDisplay = document.getElementById('velocity');
const accelerationDisplay = document.getElementById('acceleration');

let offsetX = 0;
let offsetY = 0;

// vector operations tools
const getMagnitude = v => Math.sqrt(v[0] ** 2 + v[1] ** 2);
const normalize2DVector = v => [v[0] / getMagnitude(v), v[1] / getMagnitude(v)];
const dotProduct = (v1, v2) => v1[0] * v2[0] + v1[1] * v2[1];
const getOXAngle = v => {
    if (getMagnitude(v) === 0) return 0;
    if (v[1] < 0) return 2 * Math.PI - Math.acos(v[0] / getMagnitude(v));
    else return Math.acos(v[0] / getMagnitude(v));
};
const rotateAroundCenter = (center, p, theta) => {
    const [cx, cy] = center;
    const [px, py] = p;
    const translatedX = px - cx;
    const translatedY = py - cy;
    const rotatedX = translatedX * Math.cos(theta) - translatedY * Math.sin(theta);
    const rotatedY = translatedX * Math.sin(theta) + translatedY * Math.cos(theta);
    const result = [rotatedX + cx, rotatedY + cy];
    return result;
};
const getTrueCoords = v => [v[0] + offsetX, -v[1] + offsetY];
const add2DVectors = (v1, v2) => [v1[0] + v2[0], v1[1] + v2[1]];
const scale2DVector = (v, alpha) => [alpha * v[0], alpha * v[1]];
const limit2DVector = (v, limit) => {
    const [vx, vy] = v;
    const [lx, ly] = limit;
    let rx, ry;
    if (vx >= lx) rx = lx;
    else if (vx <= -lx) rx = -lx;
    else rx = vx;
    if (vy >= ly) ry = ly;
    else if (vy <= -ly) ry = -ly;
    else ry = vy;
    return [rx, ry];
};
const getAngleBetween2DVectors = (v1, v2) => {
    if (getMagnitude(v1) === 0 || getMagnitude(v2) === 0) return 0;
    const angle1 = Math.atan2(v1[1], v1[0]);
    const angle2 = Math.atan2(v2[1], v2[0]);
    let angle = angle2 - angle1;
    if (angle > Math.PI) angle -= 2 * Math.PI;
    else if (angle < -Math.PI) angle += 2 * Math.PI;
    return angle;
};
// p1 should be the origin point
const getAngleBetween3Points = (p1, p2, p3) => {
    const v1 = [p2[0] - p1[0], p2[1] - p1[1]];
    const v2 = [p3[0] - p1[0], p3[1] - p1[1]];
    return getAngleBetween2DVectors(v1, v2);
};

const apply2DTransform = function (p, matrix) {
    const [x, y] = p;
    const [a11, a12, a21, a22] = matrix;
    return [a11 * x + a12 * y, a21 * x + a22 * y];
};

const rotate = function (p, theta) {
    const rotationMatrix = [Math.cos(theta), -Math.sin(theta), Math.sin(theta), Math.cos(theta)];
    return apply2DTransform(p, rotationMatrix);
};

const translate = function (p, translationVector) {
    const [xp, yp] = p;
    const [tx, ty] = translationVector;
    return [xp + tx, yp + ty];
};

// primitives
const setBackground = function (color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.fillRect(0, 0, W, H);
    ctx.closePath();
    ctx.restore();
};

const point = function (p, radius = 1, color = 'black') {
    const [x, y] = getTrueCoords(p);
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fill();
    ctx.closePath();
    ctx.restore();
};

const line = function (a, b, absoluteCoords = false, color = 'black') {
    const [xa, ya] = absoluteCoords ? a : getTrueCoords(a);
    const [xb, yb] = absoluteCoords ? b : getTrueCoords(b);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(xa, ya);
    ctx.lineTo(xb, yb);
    ctx.stroke();
    ctx.closePath();
    ctx.restore();
};

const triangle = function (a, b, c, color = 'black') {
    line(a, b, false, color);
    line(b, c, false, color);
    line(c, a, false, color);
};

// method for drawing a line given an origin point, the line length and an angle theta
const polarLine = function (origin, length, theta, color = 'black') {
    const endPoint = translate(rotate([length, 0], theta), origin);
    line(origin, endPoint, false, color);
};

// method for drawing a triangle given it's weight center, it's base height and an angle theta
const polarTriangle = function (weightCenter, baseLength, height, theta = 0, color = 'black') {
    const A = translate(rotate([0, (2 / 3) * height], theta), weightCenter);
    const B = translate(rotate([baseLength / 2, -(1 / 3) * height], theta), weightCenter);
    const C = translate(rotate([-baseLength / 2, -(1 / 3) * height], theta), weightCenter);
    line(A, B, false, color);
    line(B, C, false, color);
    line(C, A, false, color);
    return A;
};

const centerCanvas = function (p, drawGrid = false, gridSize = 10) {
    [offsetX, offsetY] = p;
    if (drawGrid) {
        for (let i = p[0] - gridSize * Math.floor(p[0] / gridSize); i <= W; i += gridSize) {
            line([i, 0], [i, H], true, '#aaa');
        }
        for (let i = p[1] - gridSize * Math.floor(p[1] / gridSize); i <= H; i += gridSize) {
            line([0, i], [W, i], true, '#aaa');
        }
        point([0, 0], 4, '#fff');
    }
};

class Agent {
    constructor(vertexes) {
        this.vertexes = vertexes;
        this.v = [0, 0];
        this.a = [0, 0];
        this.velDampen = 0.9925;
        this.accDampen = 0.75;
    }
    calculateNewVertexes() {
        const baseMid = [(this.vertexes[1][0] + this.vertexes[2][0]) / 2, (this.vertexes[1][1] + this.vertexes[2][1]) / 2];
        const velArrowTipX = 100 * getMagnitude(this.v) * Math.cos(getOXAngle(this.v)) + this.vertexes[0][0];
        const velArrowTipY = 100 * getMagnitude(this.v) * Math.sin(getOXAngle(this.v)) + this.vertexes[0][1];
        const velArrowTip = [velArrowTipX, velArrowTipY];
        const angle = getAngleBetween3Points(this.vertexes[0], baseMid, velArrowTip);
        const rotationAngle = angle === 0 ? 0 : angle + Math.PI;
        this.vertexes[1] = rotateAroundCenter(this.vertexes[0], this.vertexes[1], rotationAngle);
        this.vertexes[2] = rotateAroundCenter(this.vertexes[0], this.vertexes[2], rotationAngle);
    }
    update() {
        this.v = add2DVectors(this.v, this.a);
        this.vertexes = this.vertexes.map(vertex => translate(vertex, this.v));
        this.calculateNewVertexes();
        this.v = limit2DVector(this.v, [2, 2]);
        this.v = scale2DVector(this.v, this.velDampen);
        this.a = scale2DVector(this.a, this.accDampen);
    }
    display() {
        triangle(...this.vertexes);
        polarLine(this.vertexes[0], getMagnitude(this.v) * 100, getOXAngle(this.v), '#ff0000');
    }
}

const agent = new Agent([
    [0, 0],
    [40, -100],
    [-40, -100],
]);

function draw() {
    setBackground('#bbb');
    centerCanvas([W / 2, H / 2], true, 50);
    agent.update();
    agent.display();
    requestAnimationFrame(draw);
}

requestAnimationFrame(draw);

document.addEventListener('keydown', e => {
    const magnitude = 0.045;
    const key = e.key;
    switch (key) {
        case 'ArrowUp':
            agent.a[1] += magnitude;
            break;
        case 'ArrowDown':
            agent.a[1] += -magnitude;
            break;
        case 'ArrowRight':
            agent.a[0] += magnitude;
            break;
        case 'ArrowLeft':
            agent.a[0] += -magnitude;
            break;
        default:
            break;
    }
});
