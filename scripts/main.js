import * as THREE from "three";
import Stats from "three/examples/jsm/libs/stats.module.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { World } from "./world";
import { Player } from "./player";
import { Physics } from "./physics";
import { setupUI } from "./ui";
import { ModelLoader } from "./modelLoader";
import { objectiveManager } from "./objective";

// UI Setup
const stats = new Stats();
document.body.appendChild(stats.dom);
console.log("main.js loaded");

// Renderer setup
const renderer = new THREE.WebGLRenderer();
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x80a0e0);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Scene setup
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x80a0e0, 50, 75);

const world = new World();
// hide generation until the player presses a key to start
scene.add(world);

let player;
let physics;
// let modelLoader;

// objective system will only initialize once when the first user gesture is received
let gameStarted = false;

function startGame() {
  if (gameStarted) return;
  gameStarted = true;
  console.log("game start triggered");
  try {
    // generate the terrain when the game actually begins
    world.generate();
    console.log("world generated with seed", world.seed);

    // now that the world exists we can construct the player and physics
    player = new Player(scene, world);
    physics = new Physics(scene);
    modelLoader = new ModelLoader((models) => {
      player.setTool(models.pickaxe);
    });

    // reposition player above terrain at his current x/z
    const spawnY = world.getHeightAt(player.position.x, player.position.z);
    console.log("calculated spawn height", spawnY);
    player.position.y = spawnY + 1; // give a little buffer

    // setup UI now that we have player and physics
    setupUI(world, player, physics, scene);

    // request pointer lock immediately so the user doesn't need a second click
    player.controls.lock();
  } catch (e) {
    console.error("Error during world generation", e);
    return;
  }

  objectiveManager.initRandom();
  objectiveManager.start();
}

// begin game on any user gesture
document.addEventListener("keydown", () => {
  if (!gameStarted) startGame();
});
document.addEventListener("mousedown", () => {
  if (!gameStarted) startGame();
});

// Camera setup
const orbitCamera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);
orbitCamera.position.set(24, 24, 24);
orbitCamera.layers.enable(1);

const controls = new OrbitControls(orbitCamera, renderer.domElement);
controls.update();

const modelLoader = new ModelLoader((models) => {
  player.setTool(models.pickaxe);
});

let sun;
function setupLights() {
  sun = new THREE.DirectionalLight();
  sun.intensity = 1.5;
  sun.position.set(50, 50, 50);
  sun.castShadow = true;

  // Set the size of the sun's shadow box
  sun.shadow.camera.left = -40;
  sun.shadow.camera.right = 40;
  sun.shadow.camera.top = 40;
  sun.shadow.camera.bottom = -40;
  sun.shadow.camera.near = 0.1;
  sun.shadow.camera.far = 200;
  sun.shadow.bias = -0.0001;
  sun.shadow.mapSize = new THREE.Vector2(2048, 2048);
  scene.add(sun);
  scene.add(sun.target);

  const ambient = new THREE.AmbientLight();
  ambient.intensity = 0.2;
  scene.add(ambient);
}

// Render loop
let previousTime = performance.now();
function animate() {
  requestAnimationFrame(animate);

  const currentTime = performance.now();
  const dt = (currentTime - previousTime) / 1000;

  // Only update physics when player exists and controls are locked
  if (player && player.controls.isLocked) {
    physics.update(dt, player, world);
    player.update(world);
    world.update(player);

    // Position the sun relative to the player. Need to adjust both the
    // position and target of the sun to keep the same sun angle
    sun.position.copy(player.camera.position);
    sun.position.sub(new THREE.Vector3(-50, -50, -50));
    sun.target.position.copy(player.camera.position);

    // Update positon of the orbit camera to track player
    orbitCamera.position
      .copy(player.position)
      .add(new THREE.Vector3(16, 16, 16));
    controls.target.copy(player.position);
  }

  renderer.render(
    scene,
    player && player.controls.isLocked ? player.camera : orbitCamera,
  );
  stats.update();

  previousTime = currentTime;
}

window.addEventListener("resize", () => {
  // Resize camera aspect ratio and renderer size to the new window size
  orbitCamera.aspect = window.innerWidth / window.innerHeight;
  orbitCamera.updateProjectionMatrix();
  if (player) {
    player.camera.aspect = window.innerWidth / window.innerHeight;
    player.camera.updateProjectionMatrix();
  }

  renderer.setSize(window.innerWidth, window.innerHeight);
});

setupLights();
animate();
