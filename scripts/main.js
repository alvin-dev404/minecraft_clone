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
scene.fog = new THREE.Fog(0x80a0e0, 40, 65);

const world = new World();
scene.add(world);

let player;
let physics;
let modelLoader;

// Track world generation state
let worldGenerated = false;
let gameStarted = false;

// Pre-generate world on page load
function preGenerateWorld() {
  console.log("Starting world pre-generation...");
  const instructionsEl = document.getElementById("instructions");
  if (instructionsEl) {
    instructionsEl.innerHTML = `
      <h1>GENERATING WORLD...</h1>
      <p>Please wait while the terrain is being created.</p>
      <div style="margin: 20px 0; font-size: 1.2em;">⏳</div>
    `;
  }

  try {
    world.generate();
    worldGenerated = true;
    console.log("World generated with seed", world.seed);
    if (instructionsEl) {
      instructionsEl.innerHTML = `
        <h1>RESOURCE HUNT</h1>
        <p>Your task is to mine randomly assigned resources
        before the timer runs out.</p>
        <p>Complete all objective sets to win!</p>
        <h2>PRESS ANY KEY TO BEGIN</h2>
      `;
    }
  } catch (e) {
    console.error("ERROR generating world", e);
    if (instructionsEl) {
      instructionsEl.innerHTML = `
        <h1>ERROR</h1>
        <p>Failed to generate world. Please reload the page.</p>
      `;
    }
  }
}

function startGame() {
  if (gameStarted || !worldGenerated) return;
  gameStarted = true;
  console.log("game start triggered");
  try {
    // world is already generated, now create player and physics
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
    console.error("Error during game start", e);
    return;
  }

  objectiveManager.initRandom(world.seed);
  objectiveManager.start();
}

// Handle intro splash screen
let introSplashShown = false;
const bgmEl = document.getElementById("bgm");
if (bgmEl) {
  bgmEl.volume = 0.6;
}


function playBgm() {
  // Try to start audio; browsers require user gesture, which we have on intro close
  if (bgmEl && bgmEl.paused) {
    const p = bgmEl.play();
    if (p && typeof p.catch === "function") {
      p.catch(() => {
        // ignored; will retry on next interaction
      });
    }
  }
}

function closeIntroSplash() {
  const introSplash = document.getElementById("intro-splash");
  if (introSplash && !introSplashShown) {
    introSplash.classList.remove("active");
    introSplashShown = true;

    // Start BGM and world pre-generation after splash closes
    playBgm();
    preGenerateWorld();

    // Add event listeners for starting the game
    document.addEventListener("keydown", handleGameStart);
    document.addEventListener("mousedown", handleGameStart);
  }
}

function handleGameStart() {
  if (!gameStarted && worldGenerated) {
    startGame();
    // Remove listeners after game starts
    document.removeEventListener("keydown", handleGameStart);
    document.removeEventListener("mousedown", handleGameStart);
  } else {
    // If world not ready yet, ensure BGM keeps trying to play after interaction
    playBgm();
  }
}

// Intro splash listeners and Start button
const startBtn = document.getElementById("start-btn");
startBtn?.addEventListener("click", () => {
  closeIntroSplash();
});

document.addEventListener("keydown", (e) => {
  if (!introSplashShown) {
    closeIntroSplash();
  }
});
document.addEventListener("mousedown", () => {
  if (!introSplashShown) {
    closeIntroSplash();
  }
});

// Pause/Resume bgm with pointer lock state for nicer UX
document.addEventListener("pointerlockchange", () => {
  if (!bgmEl) return;
  const locked = document.pointerLockElement != null;
  if (locked) {
    playBgm();
  } else {
    // Keep playing on unlock to avoid abrupt silence; comment next line to keep always-on
    // bgmEl.pause();
  }
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
  sun.shadow.mapSize = new THREE.Vector2(1024, 1024);
  scene.add(sun);
  scene.add(sun.target);

  const ambient = new THREE.AmbientLight();
  ambient.intensity = 0.2;
  scene.add(ambient);
}

// Minimap system - 2D Canvas renderer
const minimapCanvas = document.getElementById("minimap");
const minimapCtx = minimapCanvas.getContext("2d");
minimapCanvas.width = 160;
minimapCanvas.height = 160;

// Map size in blocks
const mapSize = 80; // Show an 80x80 block area

// Resource colors and shapes
const resourceColors = {
  grass: "#90EE90",
  dirt: "#8B4513",
  stone: "#808080",
  coal_ore: "#FFD700", // Gold/Yellow for coal
  iron_ore: "#87CEEB", // Light blue for iron
  tree: "#228B22", // Forest green for trees
  leaves: "#00AA00", // Bright green for leaves
  sand: "#F4A460", // Sandy brown
  snow: "#FFFFFF", // White
  anconite: "#FF69B4", // Hot pink for anconite
};

// Track last minimap render to avoid rendering every frame
let lastMinimapRender = 0;
const minimapRenderInterval = 150; // ms between updates (increased for performance)

function drawArrow(ctx, x, y, angle, size, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(size / 2, size);
  ctx.lineTo(0, size / 2);
  ctx.lineTo(-size / 2, size);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function renderMinimap() {
  if (!player || !world) return;

  const now = performance.now();
  if (now - lastMinimapRender < minimapRenderInterval) return;
  lastMinimapRender = now;

  // Clear canvas
  minimapCtx.fillStyle = "#0f0f1e";
  minimapCtx.fillRect(0, 0, 160, 160);

  // Calculate which world blocks to show
  const blockSize = 256 / mapSize;
  const playerBlockX = Math.floor(player.position.x);
  const playerBlockZ = Math.floor(player.position.z);

  // Offset so player is in center
  const offsetX = playerBlockX - mapSize / 2;
  const offsetZ = playerBlockZ - mapSize / 2;

  const chunkSize = world.chunkSize.width;
  const playerChunkX = Math.floor(player.position.x / chunkSize);
  const playerChunkZ = Math.floor(player.position.z / chunkSize);

  // Scan terrain and draw blocks
  const blocksToScan = {};

  for (let cx = playerChunkX - 2; cx <= playerChunkX + 2; cx++) {
    for (let cz = playerChunkZ - 2; cz <= playerChunkZ + 2; cz++) {
      const chunk = world.getChunk(cx, cz);
      if (chunk && chunk.loaded) {
        // Sample surface blocks
        for (let x = 0; x < chunkSize; x++) {
          for (let z = 0; z < chunkSize; z++) {
            const worldX = cx * chunkSize + x;
            const worldZ = cz * chunkSize + z;

            // Skip if outside map bounds
            if (
              worldX < offsetX ||
              worldX >= offsetX + mapSize ||
              worldZ < offsetZ ||
              worldZ >= offsetZ + mapSize
            ) {
              continue;
            }

            // Get highest non-empty block
            let topBlock = null;
            for (let y = chunkSize - 1; y >= 0; y--) {
              const block = chunk.getBlock(x, y, z);
              if (block && block.id !== 0) {
                topBlock = block;
                break;
              }
            }

            if (topBlock) {
              const key = `${worldX},${worldZ}`;
              blocksToScan[key] = topBlock;
            }
          }
        }
      }
    }
  }

  // Draw terrain blocks
  for (const [key, block] of Object.entries(blocksToScan)) {
    const [worldX, worldZ] = key.split(",").map(Number);
    const mapX = (worldX - offsetX) * blockSize;
    const mapY = (worldZ - offsetZ) * blockSize;

    minimapCtx.fillStyle = resourceColors[block.name] || "#666";
    minimapCtx.fillRect(mapX, mapY, blockSize, blockSize);
    minimapCtx.strokeStyle = "#333";
    minimapCtx.lineWidth = 0.5;
    minimapCtx.strokeRect(mapX, mapY, blockSize, blockSize);
  }

  // Draw resource markers (coal and iron as circles with outlines)
  if (objectiveManager.currentSet) {
    for (const resource of objectiveManager.currentSet.resources) {
      const resourceName = resource.name.toLowerCase();

      for (let cx = playerChunkX - 1; cx <= playerChunkX + 1; cx++) {
        for (let cz = playerChunkZ - 1; cz <= playerChunkZ + 1; cz++) {
          const chunk = world.getChunk(cx, cz);
          if (chunk && chunk.loaded) {
            // Scan for resources (every 6 blocks for performance)
            for (let x = 0; x < chunkSize; x += 6) {
              for (let z = 0; z < chunkSize; z += 6) {
                for (
                  let y = chunkSize - 1;
                  y >= Math.max(0, chunkSize - 30);
                  y--
                ) {
                  const block = chunk.getBlock(x, y, z);
                  if (block && block.id === resource.blockId) {
                    const worldX = cx * chunkSize + x;
                    const worldZ = cz * chunkSize + z;

                    if (
                      worldX >= offsetX &&
                      worldX < offsetX + mapSize &&
                      worldZ >= offsetZ &&
                      worldZ < offsetZ + mapSize
                    ) {
                      const mapX =
                        (worldX - offsetX) * blockSize + blockSize / 2;
                      const mapY =
                        (worldZ - offsetZ) * blockSize + blockSize / 2;

                      // Draw circle for resource
                      const radius = blockSize * 0.7;
                      minimapCtx.fillStyle =
                        resourceColors[resource.name] || "#FFF";
                      minimapCtx.beginPath();
                      minimapCtx.arc(mapX, mapY, radius, 0, Math.PI * 2);
                      minimapCtx.fill();

                      // Draw outline
                      minimapCtx.strokeStyle = "#FFF";
                      minimapCtx.lineWidth = 1;
                      minimapCtx.stroke();
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  // Draw player as an arrow pointing in the direction they're looking
  const playerMapX = (playerBlockX - offsetX) * blockSize;
  const playerMapY = (playerBlockZ - offsetZ) * blockSize;

  // Get player's yaw angle (direction they're looking)
  const playerAngle = player.controls?.getObject?.().rotation?.y || 0;

  drawArrow(
    minimapCtx,
    playerMapX + blockSize / 2,
    playerMapY + blockSize / 2,
    -playerAngle,
    6,
    "#FF4444",
  );

  // Draw border
  minimapCtx.strokeStyle = "#4da6ff";
  minimapCtx.lineWidth = 2;
  minimapCtx.strokeRect(0, 0, 160, 160);

  // Update legend
  updateMinimapLegend();
}

function updateMinimapLegend() {
  const legendEl = document.getElementById("minimap-legend");
  if (!legendEl) return;

  let html = "<h3>⚔ OBJECTIVES</h3>";

  // Player
  html += '<div class="legend-item">';
  html +=
    '<div style="width: 12px; height: 12px; background: #FF4444; border: 2px solid #FFaaaa;"></div>';
  html += '<span style="font-weight: bold;">YOU</span>';
  html += "</div>";

  // Only show objective resources
  if (
    objectiveManager.currentSet &&
    objectiveManager.currentSet.resources.length > 0
  ) {
    // Define comprehensive resource styling
    const resourceStyles = {
      stone: {
        color: "#808080",
        icon: "■",
        displayName: "STONE",
      },
      coal_ore: {
        color: "#FFD700",
        icon: "●",
        displayName: "COAL",
      },
      iron_ore: {
        color: "#87CEEB",
        icon: "◆",
        displayName: "IRON",
      },
      anconite: {
        color: "#FF69B4",
        icon: "★",
        displayName: "ANCONITE",
      },
    };

    for (const resource of objectiveManager.currentSet.resources) {
      const style = resourceStyles[resource.name] || {
        color: "#CCCCCC",
        icon: "●",
        displayName: resource.name.replace(/_/g, " ").toUpperCase(),
      };

      html += '<div class="legend-item resource-item">';
      html += `<div style="width: 14px; height: 14px; background: ${style.color}; border: 2px solid ${style.color}; border-radius: 2px; display: flex; align-items: center; justify-content: center; font-size: 8px; color: #000; font-weight: bold;"></div>`;
      html += `<span class="resource-name">${style.displayName}</span>`;
      html += `<span class="resource-count">${resource.collected}/${resource.target}</span>`;
      html += "</div>";
    }
  }

  legendEl.innerHTML = html;
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

  // render minimap if game has started
  if (gameStarted) {
    renderMinimap();
  }

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

// Splash screen handlers
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    objectiveManager.closeSplash();
  }
});
document.addEventListener("click", () => {
  if (!gameStarted) return; // only close splashes during gameplay
  const questSplash = document.getElementById("quest-splash");
  if (questSplash?.classList.contains("active")) {
    objectiveManager.closeSplash();
  }
});

// Restart buttons
document.getElementById("restart-btn")?.addEventListener("click", () => {
  location.reload();
});
document.getElementById("retry-btn")?.addEventListener("click", () => {
  location.reload();
});

// World generation will start after intro splash closes
// The intro splash is shown by default and requires user interaction to proceed

animate();
