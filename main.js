let gameState = null;
let logEl = null;
let nextBtn = null;

async function loadData() {
  const [castRes, seasonRes] = await Promise.all([
    fetch("data/cast_default.json"),
    fetch("data/season_default.json")
  ]);
  const cast = await castRes.json();
  const season = await seasonRes.json();
  initGame(cast, season);
}

function initGame(cast, season) {
  gameState = {
    cast,
    season,
    activePlayers: [...cast],
    eliminated: [],
    currentRoundIndex: 0,
    currentPhaseIndex: 0
  };
  logEl.innerHTML = "";
  log("Welcome to " + season.name + "!");
}

function currentRound() {
  return gameState.season.rounds[gameState.currentRoundIndex];
}

function currentPhase() {
  const round = currentRound();
  if (!round) return null;
  return round.phases[gameState.currentPhaseIndex] || null;
}

function advancePhase() {
  const round = currentRound();
  gameState.currentPhaseIndex++;
  if (gameState.currentPhaseIndex >= round.phases.length) {
    gameState.currentPhaseIndex = 0;
    gameState.currentRoundIndex++;
  }
}

function isFinished() {
  return (
    gameState.currentRoundIndex >= gameState.season.rounds.length ||
    gameState.activePlayers.length <= 1
  );
}

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function log(text) {
  const p = document.createElement("p");
  p.textContent = text;
  logEl.appendChild(p);
  logEl.scrollTop = logEl.scrollHeight;
}

// --- Phase handlers ---

function runCampLife() {
  const p1 = randomChoice(gameState.activePlayers);
  const p2 = randomChoice(gameState.activePlayers.filter(p => p.id !== p1.id));
  const chaos = (p1.stats.chaos + p2.stats.chaos) / 2;
  if (chaos > 5) {
    log(`${p1.name} and ${p2.name} get into a huge argument at camp.`);
  } else {
    log(`${p1.name} and ${p2.name} bond while talking strategy.`);
  }
}

function runTeamChallenge() {
  const teams = {};
  for (const player of gameState.activePlayers) {
    if (!teams[player.team]) teams[player.team] = [];
    teams[player.team].push(player);
  }

  const teamNames = Object.keys(teams);
  if (teamNames.length < 2) {
    log("The challenge becomes individual as teams have dissolved.");
    return runIndividualChallenge();
  }

  const scores = teamNames.map(name => {
    const members = teams[name];
    const score = members.reduce((sum, p) => sum + p.stats.challenge, 0) +
                  Math.random() * 10;
    return { name, score };
  });

  scores.sort((a, b) => b.score - a.score);
  const winningTeam = scores[0].name;
  const losingTeam = scores[scores.length - 1].name;

  log(`${winningTeam} wins the challenge! ${losingTeam} is heading to elimination.`);
  gameState.lastLosingTeam = losingTeam;
}

function runIndividualChallenge() {
  const scored = gameState.activePlayers.map(p => ({
    player: p,
    score: p.stats.challenge + Math.random() * 5
  }));
  scored.sort((a, b) => b.score - a.score);
  const winner = scored[0].player;
  gameState.immuneId = winner.id;
  log(`${winner.name} wins individual immunity!`);
}

function runElimination() {
  let pool = gameState.activePlayers;

  if (gameState.lastLosingTeam) {
    pool = pool.filter(p => p.team === gameState.lastLosingTeam);
  }

  if (gameState.immuneId) {
    pool = pool.filter(p => p.id !== gameState.immuneId);
  }

  if (pool.length === 0) {
    log("No valid targets for elimination this round.");
    return;
  }

  const votes = new Map();
  for (const voter of gameState.activePlayers) {
    const options = pool.filter(p => p.id !== voter.id);
    if (options.length === 0) continue;
    const target = randomChoice(options);
    votes.set(target.id, (votes.get(target.id) || 0) + 1);
  }

  let eliminatedId = null;
  let maxVotes = -1;
  for (const [id, count] of votes.entries()) {
    if (count > maxVotes) {
      maxVotes = count;
      eliminatedId = id;
    }
  }

  const eliminated = gameState.activePlayers.find(p => p.id === eliminatedId);
  gameState.activePlayers = gameState.activePlayers.filter(p => p.id !== eliminatedId);
  gameState.eliminated.push(eliminated);

  log(`${eliminated.name} has been eliminated with ${maxVotes} votes.`);
  gameState.lastLosingTeam = null;
  gameState.immuneId = null;

  if (gameState.activePlayers.length === 1) {
    log(`${gameState.activePlayers[0].name} is the winner of ${gameState.season.name}!`);
  }
}

function runPhase() {
  if (isFinished()) {
    log("Season finished.");
    nextBtn.disabled = true;
    return;
  }

  const phase = currentPhase();
  if (!phase) {
    log("No more phases.");
    nextBtn.disabled = true;
    return;
  }

  switch (phase.type) {
    case "camp_life":
      runCampLife();
      break;
    case "team_challenge":
      runTeamChallenge();
      break;
    case "individual_challenge":
      runIndividualChallenge();
      break;
    case "elimination":
      runElimination();
      break;
    default:
      log("Unknown phase: " + phase.type);
  }

  advancePhase();

  if (isFinished()) {
    nextBtn.disabled = true;
  }
}

// --- UI wiring ---

window.addEventListener("DOMContentLoaded", () => {
  logEl = document.getElementById("log");
  nextBtn = document.getElementById("next");
  const resetBtn = document.getElementById("reset");

  nextBtn.addEventListener("click", runPhase);
  resetBtn.addEventListener("click", () => loadData().then(() => {
    nextBtn.disabled = false;
  }));

  loadData();
});
