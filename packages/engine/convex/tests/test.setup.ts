export {};

type ModuleMap = Record<string, () => Promise<unknown>>;

declare global {
  interface ImportMeta {
    glob: (pattern: string) => ModuleMap;
  }
}

export const modules: ModuleMap = import.meta.glob("../**/!(*.*.*)*.*s");
