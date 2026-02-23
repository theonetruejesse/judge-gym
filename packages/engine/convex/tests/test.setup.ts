export {};

type ModuleMap = Record<string, () => Promise<unknown>>;

declare global {
  interface ImportMeta {
    glob: (pattern: string) => ModuleMap;
  }
}

export function buildModules(options?: { live?: boolean }): ModuleMap {
  const modules = import.meta.glob("../**/!(*.*.*)*.*s");
  if (!options?.live) {
    modules["../platform/providers/provider_services.ts"] = () =>
      import("./provider_services_mock");
  }
  return modules;
}

export const modules: ModuleMap = buildModules();
