import { db } from "./client";
import { auditLogs } from "./schema";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface AuditInput {
  actorUserId?: number | null;
  action: string;             // e.g. "entry.submit", "settlement.create", "kyc.update"
  refType?: string;
  refId?: number;
  payload?: Record<string, unknown>;
}

export async function logAudit(input: AuditInput, tx?: Tx): Promise<void> {
  const t = tx ?? db;
  await t.insert(auditLogs).values({
    actorUserId: input.actorUserId ?? null,
    action: input.action,
    refType: input.refType,
    refId: input.refId,
    payload: input.payload ?? null,
  });
}
