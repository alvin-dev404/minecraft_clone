import { resources } from "./blocks";

// simple manager for the resource-collection objective and countdown timer
export const objectiveManager = {
  resource: null,
  target: 0,
  collected: 0,
  timeLimit: 0, // seconds
  startTime: 0,
  timerId: null,

  initRandom() {
    // pick a random resource and target count
    const idx = Math.floor(Math.random() * resources.length);
    this.resource = resources[idx];
    this.target = 5 + Math.floor(Math.random() * 16); // between 5 and 20
    this.collected = 0;
    this.timeLimit = 120; // two minutes by default
    console.log(`Objective: collect ${this.target} of ${this.resource.name}`);
    // update overlay now that the objective is known
    const objEl = document.getElementById("objective");
    if (objEl) {
      objEl.textContent = `Collect ${this.target} ${this.resource.name.replace(/_/g, " ")}.`;
    }
  },

  start() {
    this.startTime = performance.now();
    // update timer element once per second
    this.updateTimer();
    this.timerId = setInterval(() => this.updateTimer(), 1000);
  },

  updateTimer() {
    const elapsed = (performance.now() - this.startTime) / 1000;
    const remaining = Math.max(0, Math.ceil(this.timeLimit - elapsed));
    const timerEl = document.getElementById("timer");
    if (timerEl) {
      timerEl.textContent = `Time left: ${remaining}s`;
    }
    if (remaining <= 0) {
      clearInterval(this.timerId);
      this.fail();
    }
  },

  collect(blockId) {
    console.log("collect called with id", blockId);
    if (!this.resource) return;
    if (blockId === this.resource.id) {
      this.collected++;
      const objEl = document.getElementById("objective");
      if (objEl) {
        objEl.textContent = `Collected ${this.collected}/${this.target} ${this.resource.name.replace(/_/g, " ")}`;
      }
      if (this.collected >= this.target) {
        this.complete();
      }
    }
  },

  complete() {
    clearInterval(this.timerId);
    const status = document.getElementById("status");
    if (status) status.textContent = "Objective complete!";
  },

  fail() {
    const status = document.getElementById("status");
    if (status) status.textContent = "Time's up!";
  },
};
