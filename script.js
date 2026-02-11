// Constants
const EMPTY = 0;
const AGENT_A = 1; // Red
const AGENT_B = 2; // Blue

const COLOR_EMPTY = "#ffffff";
const COLOR_GRID_LINE = "#d4d4d4";
const COLOR_A = "#e74c3c";
const COLOR_B = "#3498db";

// State
let grid = [];
let gridSize = 50;
let isRunning = false;
let simulationTimeoutId;
let currentRound = 0;
let satisfiedPercent = 0;

let lastSatisfactionRate = -1;
let consecutiveIdenticalRounds = 0;
const STOP_AFTER_ROUNDS = 20;

// DOM
const canvas = document.getElementById("gridCanvas");
const ctx = canvas.getContext("2d");

const inputT = document.getElementById("paramT");
const inputSize = document.getElementById("paramSize");
const inputRatio = document.getElementById("paramRatio");
const inputEmpty = document.getElementById("paramEmpty");
const inputMaxRounds = document.getElementById("paramMaxRounds");
const inputSpeed = document.getElementById("paramSpeed");

const valSize = document.getElementById("valSize");
const valRatio = document.getElementById("valRatio");
const valEmpty = document.getElementById("valEmpty");
const dispRound = document.getElementById("roundDisplay");
const dispSat = document.getElementById("satisfactionDisplay");

const btnStart = document.getElementById("btnStart");
const btnStop = document.getElementById("btnStop");
const btnStep = document.getElementById("btnStep");
const btnReset = document.getElementById("btnReset");

// Initialization
function init() {
  canvas.width = 500;
  canvas.height = 500;

  inputSize.addEventListener("input", updateLabels);
  inputRatio.addEventListener("input", updateLabels);
  inputEmpty.addEventListener("input", updateLabels);

  btnStart.addEventListener("click", startSimulation);

  btnStop.addEventListener("click", () => stopSimulation(false));

  btnStep.addEventListener("click", () => {
    if (!isRunning) {
      const moved = step();
      // Check if 100% satisfied after step
      if (moved === 0) {
        btnStart.disabled = true;
        btnStep.disabled = true;
      }
    }
  });

  btnReset.addEventListener("click", resetSimulation);

  updateLabels();
  resetSimulation();
}

function updateLabels() {
  valSize.textContent = inputSize.value;
  valRatio.textContent = `${inputRatio.value}/${100 - inputRatio.value}`;
  valEmpty.textContent = `${inputEmpty.value}%`;
}

function resetSimulation() {
  stopSimulation(false);

  btnStart.disabled = false;
  btnStep.disabled = false;

  currentRound = 0;
  lastSatisfactionRate = -1;
  consecutiveIdenticalRounds = 0;
  gridSize = parseInt(inputSize.value);

  // Initialize Grid
  grid = [];
  const ratio = parseInt(inputRatio.value) / 100;
  const emptyPerc = parseInt(inputEmpty.value) / 100;

  for (let y = 0; y < gridSize; y++) {
    let row = [];
    for (let x = 0; x < gridSize; x++) {
      const rand = Math.random();
      if (rand < emptyPerc) {
        row.push(EMPTY);
      } else {
        const typeRand = Math.random();
        row.push(typeRand < ratio ? AGENT_A : AGENT_B);
      }
    }
    grid.push(row);
  }

  calculateStats();
  draw();
  updateUI();
}

function startSimulation() {
  if (isRunning) return;
  isRunning = true;
  btnStart.disabled = true;
  btnStop.disabled = false;
  btnStep.disabled = true;
  inputSize.disabled = true;
  loop();
}

function stopSimulation(finished = false) {
  isRunning = false;
  if (simulationTimeoutId) clearTimeout(simulationTimeoutId);

  btnStop.disabled = true;
  inputSize.disabled = false;

  if (finished) {
    btnStart.disabled = true;
    btnStep.disabled = true;
  } else {
    // Paused
    btnStart.disabled = false;
    btnStep.disabled = false;
  }
}
function loop() {
  if (!isRunning) return;

  const maxRounds = parseInt(inputMaxRounds.value);
  if (maxRounds > 0 && currentRound >= maxRounds) {
    stopSimulation(false);
    return;
  }

  const result = step();

  // All agents satisfied
  if (result.unsatisfied === 0) {
    stopSimulation(true);
    return;
  }

  // Gridlock
  if (result.moved === 0) {
    dispSat.textContent += " (Gridlock)";
    stopSimulation(true);
    return;
  }

  // Check if satisfaction rate is above 90% for a few rounds
  if (parseFloat(satisfiedPercent) > 90) {
    if (satisfiedPercent === lastSatisfactionRate) {
      consecutiveIdenticalRounds++;
    } else {
      consecutiveIdenticalRounds = 0;
    }

    if (consecutiveIdenticalRounds >= STOP_AFTER_ROUNDS) {
      stopSimulation(true);
      return;
    }
  }
  lastSatisfactionRate = satisfiedPercent;

  // Speed
  const speedVal = parseInt(inputSpeed.value);
  const delay = Math.max(0, 1000 - speedVal);

  simulationTimeoutId = setTimeout(loop, delay);
}

// Simulation step
// Returns { moved, unsatisfied }
function step() {
  currentRound++;

  const t = parseInt(inputT.value);
  let unsatisfiedAgents = [];
  let emptySpots = [];

  // Search grid to find unsatisfied agents and empty spots
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const agent = grid[y][x];
      if (agent === EMPTY) {
        emptySpots.push({ x, y });
      } else {
        if (!isSatisfied(x, y, agent, t)) {
          unsatisfiedAgents.push({ x, y, type: agent });
        }
      }
    }
  }

  // If everyone is happy, stop
  if (unsatisfiedAgents.length === 0) {
    calculateStats();
    draw();
    updateUI();
    return { moved: 0, unsatisfied: 0 };
  }

  shuffleArray(unsatisfiedAgents);

  let movedCount = 0;

  // Move agents
  for (let i = 0; i < unsatisfiedAgents.length; i++) {
    const agentObj = unsatisfiedAgents[i];

    // Try to find a SATISFACTORY spot starting at random index
    const startIndex = Math.floor(Math.random() * emptySpots.length);
    let foundSpotIndex = -1;

    for (let j = 0; j < emptySpots.length; j++) {
      const idx = (startIndex + j) % emptySpots.length;
      const spot = emptySpots[idx];

      // Check satisfaction
      grid[spot.y][spot.x] = agentObj.type;
      const isHappy = isSatisfied(spot.x, spot.y, agentObj.type, t);
      grid[spot.y][spot.x] = EMPTY; // Reset to empty

      if (isHappy) {
        foundSpotIndex = idx;
        break;
      }
    }

    // If no satisfactory spot, move to random empty spot
    if (foundSpotIndex === -1 && emptySpots.length > 0) {
      foundSpotIndex = Math.floor(Math.random() * emptySpots.length);
    }

    // Move
    if (foundSpotIndex !== -1) {
      const spot = emptySpots[foundSpotIndex];

      // Update grid
      grid[agentObj.y][agentObj.x] = EMPTY;
      grid[spot.y][spot.x] = agentObj.type;

      // Update empty list
      emptySpots.splice(foundSpotIndex, 1);

      // Add the spot that agent left as empty
      emptySpots.push({ x: agentObj.x, y: agentObj.y });

      movedCount++;
    }
  }

  calculateStats();
  draw();
  updateUI();

  return {
    moved: movedCount,
    unsatisfied: unsatisfiedAgents.length,
  };
}

// Checks if agent at is satisfied
// Above, left, right, below, or diagonal
function isSatisfied(x, y, type, threshold) {
  let sameCount = 0;

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;

      const nx = x + dx;
      const ny = y + dy;

      if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize) {
        const neighbor = grid[ny][nx];
        if (neighbor !== EMPTY && neighbor === type) {
          sameCount++;
        }
      }
    }
  }
  return sameCount >= threshold;
}

function calculateStats() {
  let totalAgents = 0;
  let satisfiedAgents = 0;
  const t = parseInt(inputT.value);

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const agent = grid[y][x];
      if (agent !== EMPTY) {
        totalAgents++;
        if (isSatisfied(x, y, agent, t)) {
          satisfiedAgents++;
        }
      }
    }
  }
  satisfiedPercent =
    totalAgents === 0
      ? "0.0"
      : ((satisfiedAgents / totalAgents) * 100).toFixed(1);
}

function updateUI() {
  dispRound.textContent = currentRound;
  dispSat.textContent = satisfiedPercent + "%";
}

function draw() {
  const size = canvas.width / gridSize;

  ctx.fillStyle = COLOR_GRID_LINE;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const agent = grid[y][x];
      let color = COLOR_EMPTY;
      if (agent === AGENT_A) color = COLOR_A;
      else if (agent === AGENT_B) color = COLOR_B;

      ctx.fillStyle = color;
      const gap = gridSize > 100 ? 0 : 1;
      ctx.fillRect(x * size, y * size, size - gap, size - gap);
    }
  }
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

init();
