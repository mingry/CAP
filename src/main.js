import * as THREE from 'three';
import './style.css';
const CONFIG = {
    introDuration: 10,
    playerSpeed: 8,
    bulletSpeed: 18,
    enemySpeed: 3.2,
    spawnEvery: 1.05,
    playerArmor: 3,
    worldX: [-10, 12],
    worldY: [-5.2, 5.2],
};
const canvas = document.querySelector('#game-canvas');
const scoreElement = document.querySelector('#score');
const armorElement = document.querySelector('#armor');
const timerElement = document.querySelector('#timer');
const progressElement = document.querySelector('#progress');
const phaseElement = document.querySelector('#phase-label');
const overlay = document.querySelector('#overlay');
const overlayTitle = document.querySelector('#overlay-title');
const overlayCopy = document.querySelector('#overlay-copy');
const startButton = document.querySelector('#start-button');
const hitFlash = document.querySelector('#hit-flash');
const mobileButtons = document.querySelectorAll('[data-control]');
const scene = new THREE.Scene();
scene.background = new THREE.Color('#07111f');
scene.fog = new THREE.Fog('#07111f', 13, 38);
const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 100);
camera.position.set(0, 0, 18);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
renderer.outputColorSpace = THREE.SRGBColorSpace;
scene.add(new THREE.AmbientLight('#9fb8ca', 1.8));
const keyLight = new THREE.DirectionalLight('#f4b860', 4);
keyLight.position.set(-5, 8, 12);
scene.add(keyLight);
const world = new THREE.Group();
scene.add(world);
const player = createPlayer();
world.add(player);
const projectiles = [];
const enemies = [];
const stars = [];
const keys = new Set();
let state = 'start';
let score = 0;
let armor = CONFIG.playerArmor;
let elapsed = 0;
let spawnTimer = 0;
let shotTimer = 0;
let boss;
let lastTime = performance.now();
createStars();
resize();
window.addEventListener('resize', resize);
window.addEventListener('keydown', (event) => {
    keys.add(event.key.toLowerCase());
    if (event.code === 'Space') {
        event.preventDefault();
        keys.add('space');
        if (state === 'start' || state === 'gameOver' || state === 'victory')
            startGame();
    }
});
window.addEventListener('keyup', (event) => {
    keys.delete(event.key.toLowerCase());
    if (event.code === 'Space')
        keys.delete('space');
});
startButton.addEventListener('click', startGame);
mobileButtons.forEach((button) => {
    const control = button.dataset.control;
    if (!control)
        return;
    const key = control === 'fire' ? 'space' : `arrow${control}`;
    const press = (event) => {
        event.preventDefault();
        keys.add(key);
        button.setPointerCapture(event.pointerId);
    };
    const release = (event) => {
        event.preventDefault();
        keys.delete(key);
    };
    button.addEventListener('pointerdown', press);
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('pointerleave', release);
});
function createPlayer() {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.62, 2.7, 6), new THREE.MeshStandardMaterial({ color: '#f4b860', metalness: 0.55, roughness: 0.3 }));
    body.rotation.z = -Math.PI / 2;
    group.add(body);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.12, 1.8), new THREE.MeshStandardMaterial({ color: '#e9eff0', metalness: 0.5, roughness: 0.36 }));
    wing.position.x = -0.2;
    group.add(wing);
    const engine = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.32, 0.62, 8), new THREE.MeshBasicMaterial({ color: '#ff765c' }));
    engine.rotation.z = Math.PI / 2;
    engine.position.x = -1.28;
    group.add(engine);
    group.position.set(-7, 0, 1);
    return group;
}
function createStars() {
    const material = new THREE.MeshBasicMaterial({ color: '#9fb8ca', transparent: true, opacity: 0.7 });
    for (let index = 0; index < 70; index += 1) {
        const star = new THREE.Mesh(new THREE.BoxGeometry(0.03 + Math.random() * 0.1, 0.03, 0.03), material.clone());
        star.position.set(-12 + Math.random() * 24, -6 + Math.random() * 12, -2 - Math.random() * 8);
        star.userData.speed = 0.4 + Math.random() * 1.6;
        world.add(star);
        stars.push(star);
    }
}
function createEnemy(kind) {
    const group = new THREE.Group();
    const color = kind === 'boss' ? '#d84c6a' : kind === 'zigzag' ? '#d97c5f' : '#72b7b0';
    const material = new THREE.MeshStandardMaterial({ color, metalness: 0.35, roughness: 0.4 });
    const core = new THREE.Mesh(kind === 'boss' ? new THREE.OctahedronGeometry(1.45, 1) : new THREE.ConeGeometry(kind === 'zigzag' ? 0.6 : 0.45, 1.5, 5), material);
    core.rotation.z = Math.PI / 2;
    group.add(core);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(kind === 'boss' ? 1.25 : 0.52, 0.08, 6, 12), new THREE.MeshBasicMaterial({ color: kind === 'boss' ? '#f4b860' : '#d9edf0' }));
    ring.rotation.y = Math.PI / 2;
    group.add(ring);
    if (kind === 'boss') {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.22, 3.8, 0.45), material);
        group.add(fin);
    }
    const enemy = {
        group,
        kind,
        health: kind === 'boss' ? 32 : 1,
        radius: kind === 'boss' ? 1.6 : 0.7,
        phase: Math.random() * Math.PI * 2,
        fireTimer: kind === 'boss' ? 1.4 : 3 + Math.random() * 2,
    };
    group.position.set(12, kind === 'boss' ? 0 : -4.5 + Math.random() * 9, kind === 'boss' ? 0 : -0.2);
    world.add(group);
    enemies.push(enemy);
    return enemy;
}
function createProjectile(friendly) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(friendly ? 0.13 : 0.17, 8, 8), new THREE.MeshBasicMaterial({ color: friendly ? '#f4b860' : '#ff5e70' }));
    const start = friendly ? player.position.clone() : new THREE.Vector3(0, 0, 0);
    mesh.position.copy(start);
    if (!friendly)
        mesh.position.set(boss?.group.position.x ?? 8, boss?.group.position.y ?? 0, 0.2);
    world.add(mesh);
    projectiles.push({ mesh, friendly, velocity: friendly ? CONFIG.bulletSpeed : -5.5, radius: friendly ? 0.22 : 0.28 });
}
function startGame() {
    state = 'playing';
    score = 0;
    armor = CONFIG.playerArmor;
    elapsed = 0;
    spawnTimer = 0;
    shotTimer = 0;
    player.position.set(-7, 0, 1);
    boss = undefined;
    for (const enemy of [...enemies])
        removeEnemy(enemy);
    for (const projectile of [...projectiles])
        removeProjectile(projectile);
    overlay.classList.remove('visible');
    updateHud();
}
function endGame(nextState) {
    state = nextState;
    overlayTitle.innerHTML = nextState === 'victory' ? 'HORIZON<br /><em>SECURED</em>' : 'SIGNAL<br /><em>LOST</em>';
    overlayCopy.innerHTML = nextState === 'victory' ? '기함이 격추되었습니다.<br />구역의 하늘을 되찾았습니다.' : '기체가 임무 한계를 넘었습니다.<br />다시 출격해 기록을 갱신하세요.';
    startButton.innerHTML = '다시 출격 <span>SPACE</span>';
    overlay.classList.add('visible');
}
function update(delta) {
    if (state !== 'playing')
        return;
    elapsed += delta;
    updatePlayer(delta);
    updateStars(delta);
    updateSpawning(delta);
    updateEnemies(delta);
    updateProjectiles(delta);
    updateHud();
}
function updatePlayer(delta) {
    const direction = new THREE.Vector3((keys.has('arrowright') ? 1 : 0) - (keys.has('arrowleft') ? 1 : 0), (keys.has('arrowup') ? 1 : 0) - (keys.has('arrowdown') ? 1 : 0), 0);
    if (direction.lengthSq() > 0)
        direction.normalize();
    player.position.addScaledVector(direction, CONFIG.playerSpeed * delta);
    player.position.x = THREE.MathUtils.clamp(player.position.x, -9, -3.2);
    player.position.y = THREE.MathUtils.clamp(player.position.y, CONFIG.worldY[0], CONFIG.worldY[1]);
    player.rotation.z = -direction.y * 0.16;
    shotTimer -= delta;
    if (keys.has('space') && shotTimer <= 0) {
        createProjectile(true);
        shotTimer = 0.22;
    }
}
function updateStars(delta) {
    for (const star of stars) {
        star.position.x -= Number(star.userData.speed) * delta;
        if (star.position.x < -13)
            star.position.x = 13;
    }
}
function updateSpawning(delta) {
    if (elapsed >= CONFIG.introDuration && !boss) {
        boss = createEnemy('boss');
        phaseElement.textContent = 'FLAGSHIP INBOUND';
        progressElement.style.background = '#d84c6a';
    }
    if (boss)
        return;
    spawnTimer -= delta;
    if (spawnTimer <= 0) {
        createEnemy(Math.random() > 0.68 ? 'zigzag' : 'scout');
        spawnTimer = Math.max(0.5, CONFIG.spawnEvery - elapsed * 0.025);
    }
}
function updateEnemies(delta) {
    for (const enemy of [...enemies]) {
        const isBoss = enemy.kind === 'boss';
        if (isBoss) {
            enemy.group.position.x = THREE.MathUtils.lerp(enemy.group.position.x, 6.3, delta * 1.4);
            enemy.group.position.y = Math.sin(elapsed * 0.75) * 2.6;
            enemy.group.rotation.y += delta * 0.55;
            enemy.fireTimer -= delta;
            if (enemy.fireTimer <= 0 && enemy.group.position.x < 8) {
                createProjectile(false);
                enemy.fireTimer = 1.2;
            }
        }
        else {
            enemy.group.position.x -= CONFIG.enemySpeed * delta;
            if (enemy.kind === 'zigzag')
                enemy.group.position.y += Math.sin(elapsed * 3 + enemy.phase) * delta * 2.7;
            enemy.group.rotation.y += delta * 2;
            if (enemy.group.position.x < -12)
                removeEnemy(enemy);
        }
        if (enemy.group.position.distanceTo(player.position) < enemy.radius + 0.58) {
            damagePlayer();
            if (!isBoss)
                removeEnemy(enemy);
        }
    }
}
function updateProjectiles(delta) {
    for (const projectile of [...projectiles]) {
        projectile.mesh.position.x += projectile.velocity * delta;
        if (projectile.mesh.position.x > 14 || projectile.mesh.position.x < -14) {
            removeProjectile(projectile);
            continue;
        }
        if (!projectile.friendly) {
            if (projectile.mesh.position.distanceTo(player.position) < projectile.radius + 0.5) {
                damagePlayer();
                removeProjectile(projectile);
            }
            continue;
        }
        for (const enemy of [...enemies]) {
            if (projectile.mesh.position.distanceTo(enemy.group.position) < projectile.radius + enemy.radius) {
                enemy.health -= 1;
                removeProjectile(projectile);
                if (enemy.health <= 0) {
                    score += enemy.kind === 'boss' ? 5000 : enemy.kind === 'zigzag' ? 200 : 100;
                    if (enemy.kind === 'boss')
                        endGame('victory');
                    removeEnemy(enemy);
                }
                break;
            }
        }
    }
}
function damagePlayer() {
    if (state !== 'playing')
        return;
    armor -= 1;
    hitFlash.animate([{ opacity: 0.3 }, { opacity: 0 }], { duration: 250, easing: 'ease-out' });
    player.scale.setScalar(1.25);
    window.setTimeout(() => player.scale.setScalar(1), 100);
    if (armor <= 0)
        endGame('gameOver');
}
function removeEnemy(enemy) {
    const index = enemies.indexOf(enemy);
    if (index >= 0)
        enemies.splice(index, 1);
    world.remove(enemy.group);
    if (boss === enemy)
        boss = undefined;
}
function removeProjectile(projectile) {
    const index = projectiles.indexOf(projectile);
    if (index >= 0)
        projectiles.splice(index, 1);
    world.remove(projectile.mesh);
}
function updateHud() {
    scoreElement.textContent = score.toString().padStart(6, '0');
    armorElement.textContent = armor.toString().padStart(2, '0');
    const shownTime = Math.min(elapsed, CONFIG.introDuration);
    timerElement.textContent = `${Math.floor(shownTime / 60).toString().padStart(2, '0')}:${Math.floor(shownTime % 60).toString().padStart(2, '0')}`;
    progressElement.style.width = `${Math.min(100, (elapsed / CONFIG.introDuration) * 100)}%`;
    if (elapsed < CONFIG.introDuration && state === 'playing')
        phaseElement.textContent = 'THREAT WINDOW';
}
function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    camera.aspect = width / height;
    camera.position.z = width < 700 ? 32 : 18;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
}
function frame(time) {
    const delta = Math.min((time - lastTime) / 1000, 0.05);
    lastTime = time;
    update(delta);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
