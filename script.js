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

let consecutiveIdenticalRounds = 0;
const STOP_AFTER_ROUNDS = 20;

// DOM
const canvas = document.getElementById("gridCanvas");
const ctx = canvas.getContext("2d");

const inputT = document.getElementById("paramT");
const inputSize = document.getElementById("paramSize");
const inputRatio = document.getElementById("paramRatio");
const inputEmpty = document.getElementById("paramEmpty");
const inputStopThreshold = document.getElementById("paramStopThreshold");
const inputSpeed = document.getElementById("paramSpeed");

const valSize = document.getElementById("valSize");
const valRatio = document.getElementById("valRatio");
const valEmpty = document.getElementById("valEmpty");
const valStopThreshold = document.getElementById("valStopThreshold");
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
  inputStopThreshold.addEventListener("input", updateLabels);

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
  valStopThreshold.textContent = `${inputStopThreshold.value}%`;
}

function resetSimulation() {
  stopSimulation(false);

  btnStart.disabled = false;
  btnStep.disabled = false;

  currentRound = 0;
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
    // Finished
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

  // Check if satisfaction is above certain threshold for a few rounds
  const currentSatisfaction = parseFloat(satisfiedPercent);
  const stopThresh = parseFloat(inputStopThreshold.value);

  if (currentSatisfaction >= stopThresh) {
    consecutiveIdenticalRounds++;
  } else {
    consecutiveIdenticalRounds = 0;
  }

  if (consecutiveIdenticalRounds >= STOP_AFTER_ROUNDS) {
    stopSimulation(true);
    return;
  }

  // Speed
  const speedVal = parseInt(inputSpeed.value, 10);
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

  // Look at each cell to see if agents are satisfied and track empty spots
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

  // Stop if all happy
  if (unsatisfiedAgents.length === 0) {
    calculateStats();
    draw();
    updateUI();
    return { moved: 0, unsatisfied: 0 };
  }

  shuffleArray(unsatisfiedAgents);

  let movedCount = 0;

  // Look for the best spot for each unsatisfied agent
  for (let i = 0; i < unsatisfiedAgents.length; i++) {
    const agentObj = unsatisfiedAgents[i];

    let satisfactorySpots = [];
    let bestSpot = null; // The spot with the most neighbors even if < t
    let maxNeighbors = -1;

    for (let j = 0; j < emptySpots.length; j++) {
      const spot = emptySpots[j];

      grid[spot.y][spot.x] = agentObj.type;

      // Count neighbors
      const neighborCount = countNeighbors(spot.x, spot.y, agentObj.type);
      const isHappy = neighborCount >= t;

      // Set back to empty
      grid[spot.y][spot.x] = EMPTY;

      if (isHappy) {
        satisfactorySpots.push(j);
      }

      // Best possible spot
      if (neighborCount > maxNeighbors) {
        maxNeighbors = neighborCount;
        bestSpot = j;
      } else if (neighborCount === maxNeighbors) {
        // Randomly pick if tie
        if (Math.random() < 0.5) bestSpot = j;
      }
    }

    let targetIndex = -1;

    if (satisfactorySpots.length > 0) {
      // Pick a random spot that makes agent happy
      const rand = Math.floor(Math.random() * satisfactorySpots.length);
      targetIndex = satisfactorySpots[rand];
    } else if (bestSpot !== -1 && maxNeighbors > 0) {
      // Go to the spot with most of same type
      targetIndex = bestSpot;
    } else {
      // Go to random spot
      targetIndex = Math.floor(Math.random() * emptySpots.length);
    }

    // Move
    if (targetIndex !== -1) {
      const spot = emptySpots[targetIndex];

      // Update grid
      grid[agentObj.y][agentObj.x] = EMPTY;
      grid[spot.y][spot.x] = agentObj.type;

      emptySpots.splice(targetIndex, 1);
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

function countNeighbors(x, y, type) {
  let count = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < gridSize && ny >= 0 && ny < gridSize) {
        const neighbor = grid[ny][nx];
        if (neighbor !== EMPTY && neighbor === type) {
          count++;
        }
      }
    }
  }
  return count;
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
