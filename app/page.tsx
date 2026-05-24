import { buildMuttonData } from "@/lib/mutton";
import { MuttonTool } from "@/components/MuttonTool";

export const dynamic = "force-dynamic";

export default async function Home() {
  try {
    const [d90, d180] = await Promise.all([buildMuttonData(90), buildMuttonData(180)]);
    return <MuttonTool d90={d90} d180={d180} />;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return (
      <main className="mx-auto max-w-2xl p-10">
        <h1 className="text-xl font-semibold text-red-700">Could not load mutton data</h1>
        <p className="mt-2 text-sm text-zinc-600">{message}</p>
        <p className="mt-2 text-xs text-zinc-500">Check DB_* env vars in .env.local and that the MySQL host is reachable.</p>
      </main>
    );
  }
}
