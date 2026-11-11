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

Deno.serve(async request => {
    if (request.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    if (request.method !== "POST") {
        return jsonResponse({ error: "Method not allowed." }, 405);
    }

    let payload: { query?: unknown; mediaType?: unknown };
    try {
        payload = await request.json();
    } catch {
        return jsonResponse({ error: "A JSON request body is required." }, 400);
    }

    const query = typeof payload.query === "string" ? payload.query.trim() : "";
    const mediaType = payload.mediaType;
    if (query.length < 2 || query.length > 100) {
        return jsonResponse({ error: "Search text must be between 2 and 100 characters." }, 400);
    }
    if (mediaType !== "movie" && mediaType !== "tv") {
        return jsonResponse({ error: "Media type must be movie or tv." }, 400);
    }

    const token = Deno.env.get("TMDB_API_READ_ACCESS_TOKEN");
    if (!token) {
        console.error("TMDB_API_READ_ACCESS_TOKEN is not configured.");
        return jsonResponse({ error: "Movie search is not configured." }, 500);
    }

    const endpoint = mediaType === "tv" ? "tv" : "movie";
    const url = new URL(`https://api.themoviedb.org/3/search/${endpoint}`);
    url.searchParams.set("query", query);
    url.searchParams.set("include_adult", "false");
    url.searchParams.set("language", "en-US");
    url.searchParams.set("page", "1");

    try {
        const response = await fetch(url, {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json"
            }
        });

        if (!response.ok) {
            console.error(`TMDB search request failed with status ${response.status}.`);
            return jsonResponse({ error: "The movie database search failed." }, 502);
        }

        const result: { results?: Array<Record<string, unknown>> } = await response.json();
        const results = (result.results || []).slice(0, 8).map(movie => ({
            id: movie.id,
            title: mediaType === "tv" ? movie.name : movie.title,
            media_type: mediaType,
            overview: typeof movie.overview === "string" ? movie.overview : "",
            release_date: mediaType === "tv" ? movie.first_air_date : movie.release_date,
            poster_path: typeof movie.poster_path === "string" ? movie.poster_path : null
        })).filter(movie => typeof movie.id === "number" && typeof movie.title === "string");

        return jsonResponse({ results });
    } catch (error) {
        console.error("TMDB search request could not be completed:", error);
        return jsonResponse({ error: "Could not reach the movie database." }, 502);
    }
});
