import { buildAnimalData } from "@/lib/animalData";
import { ProcurementTool } from "@/components/ProcurementTool";

export const dynamic = "force-dynamic";

export default async function Home() {
  try {
    const [m90, m180, c90, c180] = await Promise.all([
      buildAnimalData("mutton", 90),
      buildAnimalData("mutton", 180),
      buildAnimalData("cow", 90),
      buildAnimalData("cow", 180),
    ]);
    return (
      <ProcurementTool
        mutton={{ d90: m90, d180: m180 }}
        cow={{ d90: c90, d180: c180 }}
      />
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return (
      <main className="mx-auto max-w-2xl p-10">
        <h1 className="text-xl font-semibold text-red-700">Could not load procurement data</h1>
        <p className="mt-2 text-sm text-zinc-600">{message}</p>
        <p className="mt-2 text-xs text-zinc-500">Check DB_* env vars in .env.local and that the MySQL host is reachable.</p>
      </main>
    );
  }
}
