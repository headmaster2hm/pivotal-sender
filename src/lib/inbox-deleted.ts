import { promises as fs } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const DELETED_FILE = path.join(DATA_DIR, "inbox-deleted.json");

async function ensureStore(): Promise<string[]> {
  await fs.mkdir(DATA_DIR, { recursive: true });

  try {
    const raw = await fs.readFile(DELETED_FILE, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

export async function getDeletedInboxIds(): Promise<Set<string>> {
  const ids = await ensureStore();
  return new Set(ids);
}

export async function markInboxEmailDeleted(id: string): Promise<void> {
  const ids = await ensureStore();
  if (!ids.includes(id)) {
    ids.push(id);
    await fs.writeFile(DELETED_FILE, JSON.stringify(ids, null, 2), "utf8");
  }
}
