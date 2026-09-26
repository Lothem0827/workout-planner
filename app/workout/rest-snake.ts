export const GRID = 12;
export const TICK_MS = 240;

export type Dir = "up" | "down" | "left" | "right";

export type Cell = { x: number; y: number };

export type SnakeState = {
  snake: Cell[];
  dir: Dir;
  queued: Dir | null;
  food: Cell;
  started: boolean;
};

const OPPOSITE: Record<Dir, Dir> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

const DELTA: Record<Dir, Cell> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

function same(a: Cell, b: Cell) {
  return a.x === b.x && a.y === b.y;
}

function spawnFood(snake: Cell[], random: () => number): Cell | null {
  const open: Cell[] = [];
  for (let y = 0; y < GRID; y += 1) {
    for (let x = 0; x < GRID; x += 1) {
      if (!snake.some((cell) => cell.x === x && cell.y === y)) open.push({ x, y });
    }
  }
  if (!open.length) return null;
  return open[Math.floor(random() * open.length)] ?? null;
}

export function createSnake(random: () => number = Math.random): SnakeState {
  const snake = [
    { x: 6, y: 5 },
    { x: 5, y: 5 },
    { x: 4, y: 5 },
  ];
  return {
    snake,
    dir: "right",
    queued: null,
    food: spawnFood(snake, random) ?? { x: 9, y: 5 },
    started: false,
  };
}

function resetPlaying(random: () => number): SnakeState {
  return { ...createSnake(random), started: true };
}

export function queueDir(state: SnakeState, dir: Dir): SnakeState {
  if (!state.started) {
    const snake = dir === OPPOSITE[state.dir] ? [...state.snake].reverse() : state.snake;
    return { ...state, snake, dir, queued: null, started: true };
  }
  if (dir === state.dir || dir === OPPOSITE[state.dir]) return state;
  return { ...state, queued: dir };
}

export function step(state: SnakeState, random: () => number = Math.random): SnakeState {
  if (!state.started) return state;
  const dir = state.queued && state.queued !== OPPOSITE[state.dir] ? state.queued : state.dir;
  const head = state.snake[0];
  if (!head) return resetPlaying(random);
  const delta = DELTA[dir];
  const next = {
    x: (head.x + delta.x + GRID) % GRID,
    y: (head.y + delta.y + GRID) % GRID,
  };
  const eating = same(next, state.food);
  const body = eating ? state.snake : state.snake.slice(0, -1);
  if (body.some((cell) => same(cell, next))) return resetPlaying(random);
  const snake = [next, ...body];
  const food = eating ? spawnFood(snake, random) : state.food;
  if (!food) return resetPlaying(random);
  return { snake, dir, queued: null, food, started: true };
}
