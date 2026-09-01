import type { ProjectAddOn } from "@/lib/add-ons/types";

export function normalizeModuleName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(modulo|module|addon|add on)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function similarity(left: string, right: string) {
  const a = new Set(normalizeModuleName(left).split(" ").filter(Boolean));
  const b = new Set(normalizeModuleName(right).split(" ").filter(Boolean));
  if (!a.size || !b.size) return 0;
  const intersection = [...a].filter((token) => b.has(token)).length;
  const union = new Set([...a, ...b]).size;
  return intersection / union;
}

export function similarHistoricalModules(
  modules: ProjectAddOn[],
  projectId: string,
  name: string,
) {
  const normalized = normalizeModuleName(name);
  if (normalized.length < 2) return [];
  return modules.filter((module) => {
    if (module.projectId !== projectId) return false;
    const candidate = normalizeModuleName(module.name);
    return candidate === normalized || candidate.includes(normalized) || normalized.includes(candidate) || similarity(candidate, normalized) >= 0.6;
  });
}
