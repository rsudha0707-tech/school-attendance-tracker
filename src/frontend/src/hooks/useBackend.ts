import { createActor } from "@/backend";
import { useMemo } from "react";

// Env variable injected by vite-plugin-environment with prefix CANISTER_
declare const process: { env: Record<string, string | undefined> };

const CANISTER_ID = process.env.CANISTER_ID_BACKEND ?? "";

// No-op file handlers — this backend doesn't use object storage
async function uploadFile(_file: unknown): Promise<Uint8Array> {
  throw new Error("File upload not supported");
}
async function downloadFile(_file: Uint8Array): Promise<unknown> {
  throw new Error("File download not supported");
}

export function useBackend() {
  const actor = useMemo(() => {
    if (!CANISTER_ID) return null;
    return createActor(CANISTER_ID, uploadFile as never, downloadFile as never);
  }, []);
  return actor;
}
