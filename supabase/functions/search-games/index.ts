const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
}

let cachedClientId = "";
let cachedAccessToken = "";
let accessTokenExpiresAt = 0;

async function getAccessToken(clientId: string, clientSecret: string): Promise<string> {
    if (clientId === cachedClientId && Date.now() < accessTokenExpiresAt - 60_000) {
        return cachedAccessToken;
    }

    const url = new URL("https://id.twitch.tv/oauth2/token");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("client_secret", clientSecret);
    url.searchParams.set("grant_type", "client_credentials");

    const response = await fetch(url, { method: "POST" });
    if (!response.ok) {
        console.error(`Twitch token request failed with status ${response.status}.`);
        throw new Error("IGDB authentication failed.");
    }

    const result: { access_token?: unknown; expires_in?: unknown } = await response.json();
    if (typeof result.access_token !== "string" ||
        typeof result.expires_in !== "number" ||
        !Number.isFinite(result.expires_in)) {
        console.error("Twitch token response did not contain a valid access token.");
        throw new Error("IGDB authentication response was invalid.");
    }

    cachedClientId = clientId;
    cachedAccessToken = result.access_token;
    accessTokenExpiresAt = Date.now() + result.expires_in * 1000;
    return cachedAccessToken;
}

function releaseDate(timestamp: unknown): string | null {
    return typeof timestamp === "number" && Number.isFinite(timestamp)
        ? new Date(timestamp * 1000).toISOString().slice(0, 10)
        : null;
}

function coverUrl(game: Record<string, unknown>): string | null {
    const cover = game.cover;
    if (!cover || typeof cover !== "object" || !("url" in cover) ||
        typeof cover.url !== "string") {
        return null;
    }

    const url = cover.url.startsWith("//") ? `https:${cover.url}` : cover.url;
    return url.startsWith("https://")
        ? url.replace("/t_thumb/", "/t_cover_big/")
        : null;
}

function mapGame(game: Record<string, unknown>) {
    return {
        id: game.id,
        title: game.name,
        cover_url: coverUrl(game),
        description: typeof game.summary === "string" ? game.summary : "",
        release_date: releaseDate(game.first_release_date)
    };
}

type SearchGame = ReturnType<typeof mapGame> & { id: number; title: string };

function normalizeTitle(title: string): string {
    return title.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function titleMatchRank(title: string, query: string): number {
    if (title === query) return 0;
    if (title.startsWith(query)) return 1;
    if (title.includes(query)) return 2;
    return 3;
}

Deno.serve(async request => {
    if (request.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    if (request.method !== "POST") {
        return jsonResponse({ error: "Method not allowed." }, 405);
    }

    let payload: { query?: unknown; gameId?: unknown };
    try {
        payload = await request.json();
    } catch {
        return jsonResponse({ error: "A JSON request body is required." }, 400);
    }

    const query = typeof payload.query === "string" ? payload.query.trim() : "";
    const gameId = payload.gameId;
    if (gameId !== undefined && (!Number.isSafeInteger(gameId) || Number(gameId) < 1)) {
        return jsonResponse({ error: "Game ID must be a positive integer." }, 400);
    }
    if (gameId === undefined && (query.length < 2 || query.length > 100)) {
        return jsonResponse({ error: "Search text must be between 2 and 100 characters." }, 400);
    }

    const clientId = Deno.env.get("IGDB_CLIENT_ID");
    const clientSecret = Deno.env.get("IGDB_CLIENT_SECRET");
    if (!clientId || !clientSecret) {
        console.error("IGDB_CLIENT_ID and IGDB_CLIENT_SECRET are not configured.");
        return jsonResponse({ error: "Game search is not configured." }, 500);
    }

    let accessToken: string;
    try {
        accessToken = await getAccessToken(clientId, clientSecret);
    } catch (error) {
        console.error("Could not authenticate with IGDB:", error);
        return jsonResponse({ error: "Could not authenticate with the game database." }, 502);
    }

    const endpoint = "https://api.igdb.com/v4/games";
    const fields = "fields id,name,cover.url,summary,first_release_date;";
    const escapedQuery = query
        .replace(/[\r\n]/g, " ")
        .replace(/\\/g, "\\\\")
        .replace(/"/g, "\\\"");
    const apicalypseQueries = gameId === undefined
        ? [
            `${fields} where name = "${escapedQuery}"; limit 8;`,
            `search "${escapedQuery}"; ${fields} limit 20;`
        ]
        : [`${fields} where id = ${Number(gameId)}; limit 1;`];

    try {
        for (const apicalypseQuery of apicalypseQueries) {
            const response = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Client-ID": clientId,
                    Authorization: `Bearer ${accessToken}`,
                    Accept: "application/json",
                    "Content-Type": "text/plain"
                },
                body: apicalypseQuery
            });

            if (!response.ok) {
                console.error(`IGDB request failed with status ${response.status}.`);
                return jsonResponse({ error: "The game database search failed." }, 502);
            }

            const result: unknown = await response.json();
            const games = Array.isArray(result) ? result as Array<Record<string, unknown>> : [];
            if (gameId !== undefined) {
                const game = games[0];
                if (!game) return jsonResponse({ error: "Game not found." }, 404);
                return jsonResponse({ game: mapGame(game) });
            }

            const normalizedQuery = normalizeTitle(query);
            const results = games
                .map(mapGame)
                .filter((game): game is SearchGame =>
                    typeof game.id === "number" && typeof game.title === "string")
                .map((game, index) => ({
                    game,
                    index,
                    rank: titleMatchRank(normalizeTitle(game.title), normalizedQuery)
                }))
                .sort((a, b) => a.rank - b.rank || a.index - b.index)
                .slice(0, 8)
                .map(({ game }) => game);

            if (results.length) return jsonResponse({ results });
        }

        return jsonResponse({ results: [] });
    } catch (error) {
        console.error("IGDB request could not be completed:", error);
        return jsonResponse({ error: "Could not reach the game database." }, 502);
    }
});
