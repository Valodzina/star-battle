/// <reference types="vite/client" />

declare module '*.json' {
  const value: import('./types/level').LevelData;
  export default value;
}
