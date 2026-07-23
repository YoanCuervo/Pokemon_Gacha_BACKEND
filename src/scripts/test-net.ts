// Test rapide : Node peut-il joindre PokeAPI ?
// Lancement : npx tsx src/scripts/test-net.ts

async function main() {
	const res = await fetch("https://pokeapi.co/api/v2/pokemon/6");
	const data = (await res.json()) as { name: string; stats: unknown[] };
	console.log("OK :", data.name, "-", data.stats.length, "stats");
}

main().catch((err) => {
	console.error("ECHEC :", err);
	process.exit(1);
});
