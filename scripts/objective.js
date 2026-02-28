import { resources, blocks } from "./blocks";
import { RNG } from "./rng";

// Resource set: collection of resources and their targets
// When all are collected, player gains time bonus and a new set appears
export const objectiveManager = {
  currentSet: null, // { resources: [{blockId, target, collected}, ...], setIndex }
  sets: [], // all sets for this game
  setIndex: 0,
  totalTimeBonus: 300, // total bonus time available (5 minutes)
  timeLeftToGain: 300,
  baseTime: 120, // starting time (2 minutes)
  timeLimit: 120,
  startTime: 0,
  timerId: null,
  worldSeed: 0,

  generateSets() {
    // use world seed to generate deterministic but varied resource chains
    const rng = new RNG(this.worldSeed);
    this.sets = [];

    // create 3-5 sets of objectives
    const numSets = 3 + Math.floor(rng.random() * 3);
    for (let i = 0; i < numSets; i++) {
      const setResources = [];
      // each set has 1-3 resources
      const resourcesInSet = 1 + Math.floor(rng.random() * 3);
      const pickedIndices = new Set();

      for (let j = 0; j < resourcesInSet; j++) {
        let idx;
        do {
          idx = Math.floor(rng.random() * resources.length);
        } while (pickedIndices.has(idx));
        pickedIndices.add(idx);

        const resource = resources[idx];
        const target = 3 + Math.floor(rng.random() * 8); // 3-10 of each
        setResources.push({
          blockId: resource.id,
          name: resource.name,
          target,
          collected: 0,
        });
      }
      this.sets.push({ resources: setResources, setIndex: i });
    }
    console.log(`Generated ${numSets} objective sets`);
  },

  initRandom(worldSeed) {
    this.worldSeed = worldSeed;
    this.setIndex = 0;
    this.timeLeftToGain = this.totalTimeBonus;
    this.timeLimit = this.baseTime;
    this.generateSets();
    this.loadSet(0);
  },

  loadSet(index) {
    if (index >= this.sets.length) {
      // all sets complete!
      this.allComplete();
      return;
    }
    this.setIndex = index;
    this.currentSet = this.sets[index];
    // reset collected counts
    this.currentSet.resources.forEach((r) => (r.collected = 0));

    this.updateObjectiveDisplay();
    console.log(
      `Loaded set ${index + 1}/${this.sets.length}: ${this.getSetDescription()}`,
    );
  },

  getSetDescription() {
    if (!this.currentSet) return "No objective";
    return this.currentSet.resources
      .map((r) => `${r.target} ${r.name}`)
      .join(", ");
  },

  updateObjectiveDisplay() {
    if (!this.currentSet) return;
    const objEl = document.getElementById("objective");
    if (objEl) {
      const items = this.currentSet.resources
        .map((r) => `${r.collected}/${r.target} ${r.name.replace(/_/g, " ")}`)
        .join(" | ");
      objEl.textContent = `[Set ${this.setIndex + 1}/${this.sets.length}] ${items}`;
    }
  },

  start() {
    this.startTime = performance.now();
    this.updateTimer();
    this.timerId = setInterval(() => this.updateTimer(), 1000);
  },

  updateTimer() {
    const elapsed = (performance.now() - this.startTime) / 1000;
    const remaining = Math.max(0, Math.ceil(this.timeLimit - elapsed));
    const timerEl = document.getElementById("timer");
    const timerMain = document.getElementById("timer-main");
    const timerBonus = document.getElementById("timer-bonus");
    const timerBarFill = document.getElementById("timer-bar-fill");

    if (timerEl) {
      if (timerMain) timerMain.textContent = `Time: ${remaining}s`;
      if (timerBonus) timerBonus.textContent = `Bonus: ${this.timeLeftToGain}s`;

      // Calculate progress bar percentage (0-100%)
      const progressPercent = Math.max(0, (remaining / this.timeLimit) * 100);
      if (timerBarFill) {
        timerBarFill.style.width = progressPercent + "%";
      }

      // Update visual state based on remaining time
      timerEl.classList.remove("low-time", "critical-time");
      if (remaining <= 10 && remaining > 3) {
        timerEl.classList.add("low-time");
      } else if (remaining <= 3) {
        timerEl.classList.add("critical-time");
      }
    }

    if (remaining <= 0) {
      clearInterval(this.timerId);
      this.fail();
    }
  },

  collect(blockId) {
    if (!this.currentSet) return;

    let setComplete = true;
    for (const resource of this.currentSet.resources) {
      if (
        resource.blockId === blockId &&
        resource.collected < resource.target
      ) {
        resource.collected++;
        console.log(
          `Collected ${resource.name}: ${resource.collected}/${resource.target}`,
        );
      }
      if (resource.collected < resource.target) {
        setComplete = false;
      }
    }

    this.updateObjectiveDisplay();

    if (setComplete) {
      this.completeSet();
    }
  },

  completeSet() {
    clearInterval(this.timerId);
    const bonus = Math.min(20, this.timeLeftToGain);
    this.timeLeftToGain -= bonus;
    this.timeLimit += bonus;
    const status = document.getElementById("status");
    if (status) status.textContent = `+${bonus}s! Moving to next objective...`;
    console.log(`Set complete! Bonus: +${bonus}s`);

    // load next set after a short delay
    setTimeout(() => {
      this.loadSet(this.setIndex + 1);
      this.start();
    }, 2000);
  },

  allComplete() {
    clearInterval(this.timerId);
    const status = document.getElementById("status");
    if (status) status.textContent = "All objectives complete! You win!";
  },

  fail() {
    const status = document.getElementById("status");
    if (status) status.textContent = "Time's up! Game Over.";
  },
};
