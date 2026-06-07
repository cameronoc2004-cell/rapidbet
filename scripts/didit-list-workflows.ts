import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const API_KEY = process.env.DIDIT_API_KEY ?? "";
  if (!API_KEY) {
    console.error("Missing DIDIT_API_KEY");
    process.exit(1);
  }

  const url = "https://verification.didit.me/v3/workflows/";
  const res = await fetch(url, { method: "GET", headers: { "x-api-key": API_KEY } });
  if (!res.ok) {
    console.error(`HTTP ${res.status}\n${await res.text()}`);
    process.exit(1);
  }
  const data = (await res.json()) as unknown;
  const rows = Array.isArray(data) ? data : (data as { results?: unknown[] }).results ?? [];
  if (rows.length === 0) {
    console.log("This API key has visibility on 0 workflows. Wrong Application scope.");
  }
  for (const w of rows as Array<{ uuid?: string; workflow_label?: string; status?: string; workflow_type?: string }>) {
    console.log(
      `${w.status?.padEnd(10)} ${w.uuid}  ${w.workflow_label}  (${w.workflow_type})`,
    );
  }
}

main();
