export type PersonaId = "admin" | "operator" | "viewer";

export interface Persona {
  id: PersonaId;
  label: string;
  description: string;
  bearer: string;
  email: string;
  sections: string[];
}

export const PERSONAS: Persona[] = [
  {
    id: "operator",
    label: "Operator",
    description: "Fleet, MCP, merge gate, self-serve billing",
    bearer: "operator",
    email: "jeffry@example.com",
    sections: ["command", "monitoring", "context", "billing", "usage"],
  },
  {
    id: "admin",
    label: "Admin",
    description: "Users, coupons, campaigns, credits, events",
    bearer: "admin",
    email: "admin@ade.local",
    sections: ["admin", "billing", "usage", "command"],
  },
  {
    id: "viewer",
    label: "Viewer",
    description: "Read-only entitlements and usage",
    bearer: "viewer",
    email: "viewer@ade.local",
    sections: ["command", "usage"],
  },
];

export function getPersona(id: PersonaId): Persona {
  return PERSONAS.find((p) => p.id === id) ?? PERSONAS[0]!;
}

const STORAGE_KEY = "hr-ade-persona";

export function loadPersona(): PersonaId {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "admin" || v === "operator" || v === "viewer") return v;
  } catch { /* ignore */ }
  return "operator";
}

export function savePersona(id: PersonaId): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch { /* ignore */ }
}
