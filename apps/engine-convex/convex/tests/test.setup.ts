export {};

type ModuleMap = Record<string, () => Promise<unknown>>;

declare global {
  interface ImportMeta {
    glob: (pattern: string) => ModuleMap;
  }
}

export function buildModules(): ModuleMap {
  return import.meta.glob("../**/!(*.*.*)*.*s");
}

export const modules: ModuleMap = buildModules();
