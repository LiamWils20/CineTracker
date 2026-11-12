const loginView = document.getElementById("loginView");
const authenticatedView = document.getElementById("authenticatedView");
const loginButton = document.getElementById("loginButton");
const logoutButton = document.getElementById("logoutButton");
const settingsLogoutButton = document.getElementById("settingsLogoutButton");
const addMovieButton = document.getElementById("addMovieButton");
const addGameButton = document.getElementById("addGameButton");
const closeFormButton = document.getElementById("closeFormButton");
const cancelFormButton = document.getElementById("cancelFormButton");
const closeGameFormButton = document.getElementById("closeGameFormButton");
const cancelGameFormButton = document.getElementById("cancelGameFormButton");
const viewAllButton = document.getElementById("viewAllButton");
const suggestFilmButton = document.getElementById("suggestFilmButton");
const suggestPlannedGameButton = document.getElementById("suggestPlannedGameButton");
const suggestPlayingGameButton = document.getElementById("suggestPlayingGameButton");
const searchInput = document.getElementById("searchInput");
const dashboardView = document.getElementById("dashboardView");
const gamesView = document.getElementById("gamesView");
const settingsView = document.getElementById("settingsView");
const addFormPanel = document.getElementById("addFormPanel");
const addForm = document.getElementById("addForm");
const addGameFormPanel = document.getElementById("addGameFormPanel");
const gameForm = document.getElementById("gameForm");
const watchlist = document.getElementById("watchlist");
const gameCollection = document.getElementById("gameCollection");
const message = document.getElementById("message");
const detailsDialog = document.getElementById("detailsDialog");
const titleInput = document.getElementById("title");
const mediaTypeInput = document.getElementById("mediaType");
const statusInput = document.getElementById("status");
const movieSearchStatus = document.getElementById("movieSearchStatus");
const movieSearchResults = document.getElementById("movieSearchResults");
const selectedMoviePreview = document.getElementById("selectedMoviePreview");
const gameTitleInput = document.getElementById("gameTitle");
const gameStatusInput = document.getElementById("gameStatus");
const gameSearchStatus = document.getElementById("gameSearchStatus");
const gameSearchResults = document.getElementById("gameSearchResults");
const selectedGamePreview = document.getElementById("selectedGamePreview");
const movieStatsPanel = document.getElementById("movieStatsPanel");
const gameStatsPanel = document.getElementById("gameStatsPanel");

let currentUser = null;
let items = [];
let gameItems = [];
let currentView = "home";
let editingItem = null;
let editingGame = null;
let featuredItem = null;
let selectedMovie = null;
let selectedGame = null;
let searchTimer = null;
let gameSearchTimer = null;
let movieSearchSequence = 0;
let gameSearchSequence = 0;

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";

function posterUrl(posterPath) {
    return typeof posterPath === "string" && posterPath.startsWith("/")
        ? `${TMDB_IMAGE_BASE}${posterPath}`
        : "";
}

function setPoster(image, posterPath, alt = "") {
    const url = posterUrl(posterPath);
    image.alt = alt;
    image.hidden = !url;
    image.onerror = () => {
        image.hidden = true;
        image.removeAttribute("src");
        if (image.id === "featuredPoster") {
            image.parentElement.classList.remove("has-image");
            document.getElementById("posterTitle").textContent =
                featuredItem?.title.toUpperCase() || "CINETRACK";
        }
    };

    if (url) image.src = url;
    else image.removeAttribute("src");
}

function setGameCover(image, coverUrl, alt = "") {
    const url = typeof coverUrl === "string" && coverUrl.startsWith("https://")
        ? coverUrl
        : "";
    image.alt = alt;
    image.hidden = !url;
    image.onerror = () => {
        image.hidden = true;
        image.removeAttribute("src");
    };

    if (url) image.src = url;
    else image.removeAttribute("src");
}

function showMessage(text) {
    message.textContent = text;
}

function setAuthenticated(user) {
    currentUser = user;
    loginView.hidden = Boolean(user);
    authenticatedView.hidden = !user;

    if (!user) {
        items = [];
        gameItems = [];
        updateGameStats();
        return;
    }

    const name = user.user_metadata?.full_name || user.email || "there";
    document.getElementById("welcome").textContent = `Signed in as ${name}`;
}

loginButton.addEventListener("click", async () => {
    showMessage("");
    if (window.location.protocol === "file:") {
        showMessage("Open CineTrack through a local web server (such as VS Code Live Server) before signing in.");
        return;
    }

    loginButton.disabled = true;
    loginButton.textContent = "Connecting to Google...";

    try {
        const redirectTo = new URL(window.location.pathname, window.location.origin).href;
        const { data, error } = await supabaseClient.auth.signInWithOAuth({
            provider: "google",
            options: {
                redirectTo,
                skipBrowserRedirect: true
            }
        });

        if (error) throw error;
        if (!data.url) throw new Error("Supabase did not return a Google sign-in URL.");

        window.location.assign(data.url);
    } catch (error) {
        showMessage(`Couldn't start Google sign-in: ${error.message}`);
        loginButton.disabled = false;
        loginButton.textContent = "Sign in with Google";
    }
});

async function signOut() {
    const { error } = await supabaseClient.auth.signOut();
    if (error) {
        showMessage(error.message);
        return;
    }
    setAuthenticated(null);
    showMessage("You have signed out.");
}

logoutButton.addEventListener("click", signOut);
settingsLogoutButton.addEventListener("click", signOut);

async function checkUser() {
    const callbackParams = new URLSearchParams(window.location.search);
    const callbackHash = new URLSearchParams(window.location.hash.slice(1));
    const callbackError = callbackParams.get("error_description")
        || callbackHash.get("error_description")
        || callbackParams.get("error")
        || callbackHash.get("error");

    if (callbackError) {
        showMessage(`Google sign-in failed: ${callbackError}`);
    }

    const { data, error } = await supabaseClient.auth.getSession();
    if (error) {
        showMessage(error.message);
        setAuthenticated(null);
        return;
    }

    const user = data.session?.user || null;
    setAuthenticated(user);
    if (user) await Promise.all([loadWatchlist(), loadGameLibrary()]);
}

supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        setTimeout(async () => {
            setAuthenticated(session?.user || null);
            if (session?.user) {
                await Promise.all([loadWatchlist(), loadGameLibrary()]);
            }
        }, 0);
    }
});

function updateStats() {
    const watched = items.filter(item => item.status === "watched").length;
    document.getElementById("totalCount").textContent = items.length;
    document.getElementById("watchedCount").textContent = watched;
    document.getElementById("watchlistCount").textContent = items.length - watched;
}

function updateGameStats() {
    document.getElementById("gameTotalCount").textContent = gameItems.length;
    document.getElementById("gamePlayingCount").textContent =
        gameItems.filter(game => game.status === "playing").length;
    document.getElementById("gameCompletedCount").textContent =
        gameItems.filter(game => game.status === "completed").length;
    document.getElementById("gamePlannedCount").textContent =
        gameItems.filter(game => game.status === "planned").length;
}

function updateFeatured() {
    featuredItem = items[0] || null;
    const featuredTitle = document.getElementById("featuredTitle");
    const featuredType = document.getElementById("featuredType");
    const featuredStatus = document.getElementById("featuredStatus");
    const detailsButton = document.getElementById("detailsButton");
    const editButton = document.getElementById("editButton");
    const featuredPoster = document.getElementById("featuredPoster");
    const posterFrame = featuredPoster.parentElement;

    if (!featuredItem) {
        featuredTitle.textContent = "Welcome to CineTrack";
        featuredType.textContent = "Add a movie or show to get started";
        document.getElementById("posterTitle").textContent = "CINETRACK";
        document.getElementById("featuredDescription").textContent =
            "Build your personal watchlist and keep track of what you have watched.";
        featuredStatus.hidden = true;
        detailsButton.disabled = true;
        editButton.disabled = true;
        setPoster(featuredPoster, null);
        posterFrame.classList.remove("has-image");
        return;
    }

    featuredTitle.textContent = featuredItem.title;
    featuredType.textContent = featuredItem.media_type === "tv" ? "TV Series" : "Film";
    document.getElementById("posterTitle").textContent =
        featuredItem.poster_path ? "" : featuredItem.title.toUpperCase();
    document.getElementById("featuredDescription").textContent =
        featuredItem.overview || `This ${featuredItem.media_type === "tv" ? "series" : "film"} is in your collection.`;
    setPoster(featuredPoster, featuredItem.poster_path, `${featuredItem.title} poster`);
    posterFrame.classList.toggle("has-image", Boolean(posterUrl(featuredItem.poster_path)));
    document.getElementById("featuredStatusText").textContent =
        featuredItem.status === "watched" ? "Watched" :
            featuredItem.status === "watching" ? "Currently watching" : "Plan to watch";
    featuredStatus.hidden = false;
    detailsButton.disabled = false;
    editButton.disabled = false;
}

function filteredItems() {
    const search = searchInput.value.trim().toLocaleLowerCase();
    return items.filter(item => {
        const matchesSearch = item.title.toLocaleLowerCase().includes(search);
        const matchesView = currentView === "watched"
            ? item.status === "watched"
            : currentView === "planned"
                ? item.status !== "watched"
                : true;
        return matchesSearch && matchesView;
    });
}

function createCollectionCard(item) {
    const card = document.createElement("article");
    card.className = "collection-card";

    const cover = document.createElement("div");
    cover.className = "collection-card__cover";
    if (posterUrl(item.poster_path)) {
        const poster = document.createElement("img");
        poster.loading = "lazy";
        setPoster(poster, item.poster_path, `${item.title} poster`);
        cover.appendChild(poster);
    } else {
        cover.setAttribute("aria-hidden", "true");
    }

    const content = document.createElement("div");
    content.className = "collection-card__content";

    const title = document.createElement("h4");
    title.textContent = item.title;

    const details = document.createElement("p");
    details.textContent = `${item.media_type === "tv" ? "TV Series" : "Film"} · ${
        item.status === "watched" ? "Watched" :
            item.status === "watching" ? "Currently watching" : "Plan to watch"
    }`;

    const actions = document.createElement("div");
    actions.className = "card-actions";

    const detailsButton = document.createElement("button");
    detailsButton.type = "button";
    detailsButton.className = "btn btn-secondary";
    detailsButton.textContent = "Details";
    detailsButton.addEventListener("click", () => showDetails(item));

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "btn btn-secondary";
    editButton.textContent = "Edit";
    editButton.addEventListener("click", () => openForm(item));

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "btn btn-remove";
    removeButton.textContent = "Remove";
    removeButton.addEventListener("click", () => deleteItem(item.id));

    actions.append(detailsButton, editButton, removeButton);
    content.append(title, details, actions);
    card.append(cover, content);
    return card;
}

function renderWatchlist() {
    const visibleItems = filteredItems();
    watchlist.replaceChildren();

    if (!visibleItems.length) {
        const empty = document.createElement("p");
        empty.className = "empty-state";
        empty.textContent = items.length
            ? "No titles match this view or search."
            : "Your collection is empty. Add a movie or show to get started.";
        watchlist.appendChild(empty);
        return;
    }

    visibleItems.forEach(item => watchlist.appendChild(createCollectionCard(item)));
}

function gameStatusLabel(status) {
    return status === "completed" ? "Completed" :
        status === "playing" ? "Currently playing" : "Want to play";
}

function isGameView(view) {
    return view === "games" || view === "games-playing" ||
        view === "games-planned" || view === "games-completed";
}

function createGameCard(game) {
    const card = document.createElement("article");
    card.className = "collection-card";

    const cover = document.createElement("div");
    cover.className = "collection-card__cover";
    if (game.cover_url) {
        const image = document.createElement("img");
        image.loading = "lazy";
        setGameCover(image, game.cover_url, `${game.title} cover`);
        cover.appendChild(image);
    } else {
        cover.setAttribute("aria-hidden", "true");
    }

    const content = document.createElement("div");
    content.className = "collection-card__content";

    const title = document.createElement("h4");
    title.textContent = game.title;

    const details = document.createElement("p");
    details.textContent = `Video game · ${gameStatusLabel(game.status)}`;

    const actions = document.createElement("div");
    actions.className = "card-actions";

    const detailsButton = document.createElement("button");
    detailsButton.type = "button";
    detailsButton.className = "btn btn-secondary";
    detailsButton.textContent = "Details";
    detailsButton.addEventListener("click", () => showGameDetails(game));

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "btn btn-secondary";
    editButton.textContent = "Edit";
    editButton.addEventListener("click", () => openGameForm(game));

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "btn btn-remove";
    removeButton.textContent = "Remove";
    removeButton.addEventListener("click", () => deleteGameItem(game.id));

    actions.append(detailsButton, editButton, removeButton);
    content.append(title, details, actions);
    card.append(cover, content);
    return card;
}

function renderGameLibrary() {
    if (!gameCollection) return;

    const query = searchInput.value.trim().toLocaleLowerCase();
    const visibleGames = gameItems.filter(game =>
        game.title.toLocaleLowerCase().includes(query) &&
        (currentView === "games" ||
            (currentView === "games-playing" && game.status === "playing") ||
            (currentView === "games-planned" && game.status === "planned") ||
            (currentView === "games-completed" && game.status === "completed"))
    );
    gameCollection.replaceChildren();

    if (!visibleGames.length) {
        const empty = document.createElement("p");
        empty.className = "empty-state";
        if (gameItems.length) {
            empty.textContent = "No games match this view or search.";
        } else {
            empty.textContent = "Your games library is empty. Add a game to get started.";
        }
        gameCollection.appendChild(empty);
        return;
    }

    visibleGames.forEach(game => gameCollection.appendChild(createGameCard(game)));
}

async function loadWatchlist() {
    if (!currentUser) return;

    watchlist.textContent = "Loading...";
    const { data, error } = await supabaseClient
        .from("watchlist_items")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        showMessage(error.message);
        watchlist.textContent = "Couldn't load your collection.";
        return;
    }

    items = data || [];
    updateStats();
    updateFeatured();
    renderWatchlist();
}

async function loadGameLibrary() {
    if (!currentUser) return;

    gameCollection.textContent = "Loading...";
    const { data, error } = await supabaseClient
        .from("game_items")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        showMessage(error.message);
        gameCollection.textContent = "Couldn't load your games library.";
        return;
    }

    gameItems = data || [];
    updateGameStats();
    renderGameLibrary();
}

function setView(view) {
    currentView = view;
    const isSettings = view === "settings";
    const isGames = isGameView(view);
    dashboardView.hidden = isSettings || isGames;
    gamesView.hidden = !isGames;
    settingsView.hidden = !isSettings;
    addFormPanel.hidden = true;
    addGameFormPanel.hidden = true;
    movieStatsPanel.hidden = isSettings || isGames;
    gameStatsPanel.hidden = !isGames;
    suggestFilmButton.hidden = view !== "planned";
    suggestPlannedGameButton.hidden = view !== "games-planned";
    suggestPlayingGameButton.hidden = view !== "games-playing";
    searchInput.placeholder = isGames ? "Search games..." : "Search movies...";
    searchInput.setAttribute("aria-label", isGames ? "Search games" : "Search movies");

    document.querySelectorAll(".nav-item").forEach(button => {
        button.classList.toggle("active", button.dataset.view === view);
    });

    const headings = {
        home: "My Collection",
        planned: "To Watch",
        watched: "Watched",
        lists: "All Movies",
        games: "My Games",
        "games-playing": "In Progress",
        "games-planned": "Want to Play",
        "games-completed": "Completed"
    };
    if (isGames) {
        document.getElementById("game-library-heading").textContent = headings[view];
    } else if (headings[view]) {
        document.getElementById("library-heading").textContent = headings[view];
    }
    renderWatchlist();
    renderGameLibrary();
}

document.querySelectorAll(".nav-item").forEach(button => {
    button.addEventListener("click", () => setView(button.dataset.view));
});

searchInput.addEventListener("input", () => {
    renderWatchlist();
    renderGameLibrary();
});

function openForm(item = null) {
    editingItem = item;
    selectedMovie = item?.tmdb_id ? {
        id: item.tmdb_id,
        title: item.title,
        media_type: item.media_type,
        poster_path: item.poster_path,
        overview: item.overview,
        release_date: item.release_date
    } : null;
    addForm.reset();
    movieSearchResults.replaceChildren();
    movieSearchResults.hidden = true;
    movieSearchStatus.textContent = "";
    renderSelectedMovie();
    document.getElementById("formHeading").textContent =
        item ? "Edit collection item" : "Add to your collection";
    document.getElementById("saveItemButton").textContent =
        item ? "Save changes" : "Add to collection";
    if (item) {
        titleInput.value = item.title;
        mediaTypeInput.value = item.media_type;
        statusInput.value = item.status;
    }

    dashboardView.hidden = true;
    gamesView.hidden = true;
    settingsView.hidden = true;
    addFormPanel.hidden = false;
    titleInput.focus();
}

function closeForm() {
    movieSearchSequence++;
    window.clearTimeout(searchTimer);
    editingItem = null;
    selectedMovie = null;
    addFormPanel.hidden = true;
    dashboardView.hidden = currentView === "settings" || isGameView(currentView);
    gamesView.hidden = !isGameView(currentView);
    settingsView.hidden = currentView !== "settings";
    addForm.reset();
    movieSearchResults.replaceChildren();
    movieSearchResults.hidden = true;
    movieSearchStatus.textContent = "";
    selectedMoviePreview.hidden = true;
}

addMovieButton.addEventListener("click", () => openForm());
closeFormButton.addEventListener("click", closeForm);
cancelFormButton.addEventListener("click", closeForm);

function openGameForm(game = null) {
    editingGame = game;
    selectedGame = game?.igdb_id ? {
        id: game.igdb_id,
        title: game.title,
        cover_url: game.cover_url,
        description: game.description,
        release_date: game.release_date
    } : null;
    gameForm.reset();
    gameSearchResults.replaceChildren();
    gameSearchResults.hidden = true;
    gameSearchStatus.textContent = "";
    renderSelectedGame();
    document.getElementById("gameFormHeading").textContent =
        game ? "Edit game" : "Add a game";
    document.getElementById("saveGameButton").textContent =
        game ? "Save changes" : "Add to games";
    if (game) {
        gameTitleInput.value = game.title;
        gameStatusInput.value = game.status;
    }

    dashboardView.hidden = true;
    gamesView.hidden = true;
    settingsView.hidden = true;
    addFormPanel.hidden = true;
    addGameFormPanel.hidden = false;
    gameTitleInput.focus();
}

function closeGameForm() {
    gameSearchSequence++;
    window.clearTimeout(gameSearchTimer);
    editingGame = null;
    selectedGame = null;
    addGameFormPanel.hidden = true;
    gamesView.hidden = !isGameView(currentView);
    dashboardView.hidden = currentView === "settings" || isGameView(currentView);
    settingsView.hidden = currentView !== "settings";
    gameForm.reset();
    gameSearchResults.replaceChildren();
    gameSearchResults.hidden = true;
    gameSearchStatus.textContent = "";
    selectedGamePreview.hidden = true;
}

addGameButton.addEventListener("click", () => openGameForm());
closeGameFormButton.addEventListener("click", closeGameForm);
cancelGameFormButton.addEventListener("click", closeGameForm);

function renderSelectedGame() {
    if (!selectedGame) {
        selectedGamePreview.hidden = true;
        return;
    }

    setGameCover(
        document.getElementById("selectedGameCover"),
        selectedGame.cover_url,
        `${selectedGame.title} cover`
    );
    document.getElementById("selectedGameTitle").textContent = selectedGame.title;
    document.getElementById("selectedGameYear").textContent =
        selectedGame.release_date?.slice(0, 4) || "";
    selectedGamePreview.hidden = false;
}

function renderGameSearchResults(results) {
    gameSearchResults.replaceChildren();
    gameSearchResults.hidden = !results.length;

    results.forEach(game => {
        const option = document.createElement("button");
        option.type = "button";
        option.className = "movie-search-result";
        option.setAttribute("role", "option");

        const image = document.createElement("img");
        image.alt = "";
        image.loading = "lazy";
        setGameCover(image, game.cover_url);

        const text = document.createElement("span");
        text.className = "movie-search-result__text";
        const title = document.createElement("strong");
        title.textContent = game.title;
        const year = document.createElement("small");
        year.textContent = game.release_date?.slice(0, 4) || "Year unavailable";
        text.append(title, year);
        option.append(image, text);

        option.addEventListener("click", async () => {
            const sequence = ++gameSearchSequence;
            selectedGame = game;
            gameTitleInput.value = game.title;
            gameSearchResults.replaceChildren();
            gameSearchResults.hidden = true;
            gameSearchStatus.textContent = "Loading game details...";
            renderSelectedGame();

            const { data, error } = await supabaseClient.functions.invoke("search-games", {
                body: { gameId: game.id }
            });
            if (sequence !== gameSearchSequence) return;

            if (error) {
                gameSearchStatus.textContent = "Game selected; extra details could not be loaded.";
                console.error("IGDB game details failed:", error);
                return;
            }

            if (data?.game) {
                selectedGame = { ...selectedGame, ...data.game };
                renderSelectedGame();
            }
            gameSearchStatus.textContent = "Game selected.";
        });

        gameSearchResults.appendChild(option);
    });
}

async function searchGames(query, sequence) {
    gameSearchStatus.textContent = "Searching IGDB...";
    gameSearchResults.hidden = true;

    const { data, error } = await supabaseClient.functions.invoke("search-games", {
        body: { query }
    });

    if (sequence !== gameSearchSequence) return;

    if (error) {
        gameSearchStatus.textContent =
            "Game search isn't available. Check the Supabase function setup and try again.";
        console.error("IGDB game search failed:", error);
        return;
    }

    const results = Array.isArray(data?.results) ? data.results : [];
    if (!results.length) {
        gameSearchStatus.textContent = "No matches found. You can still add the game without a cover.";
        return;
    }

    gameSearchStatus.textContent = "Choose a game to use its cover and details.";
    renderGameSearchResults(results);
}

gameTitleInput.addEventListener("input", () => {
    selectedGame = null;
    renderSelectedGame();
    gameSearchResults.replaceChildren();
    gameSearchResults.hidden = true;
    window.clearTimeout(gameSearchTimer);

    const query = gameTitleInput.value.trim();
    if (query.length < 2) {
        gameSearchSequence++;
        gameSearchStatus.textContent = "";
        return;
    }

    const sequence = ++gameSearchSequence;
    gameSearchTimer = window.setTimeout(() => searchGames(query, sequence), 350);
});

document.getElementById("clearGameSelection").addEventListener("click", () => {
    selectedGame = null;
    renderSelectedGame();
    gameTitleInput.dispatchEvent(new Event("input"));
    gameTitleInput.focus();
});

gameForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (!currentUser) return;

    const gameData = {
        title: gameTitleInput.value.trim(),
        status: gameStatusInput.value
    };
    if (!gameData.title) return;

    if (selectedGame) {
        Object.assign(gameData, {
            igdb_id: selectedGame.id,
            cover_url: selectedGame.cover_url,
            description: selectedGame.description,
            release_date: selectedGame.release_date
        });
    } else if (editingGame && editingGame.title === gameData.title) {
        Object.assign(gameData, {
            igdb_id: editingGame.igdb_id,
            cover_url: editingGame.cover_url,
            description: editingGame.description,
            release_date: editingGame.release_date
        });
    } else {
        Object.assign(gameData, {
            igdb_id: null,
            cover_url: null,
            description: null,
            release_date: null
        });
    }

    const request = editingGame
        ? supabaseClient.from("game_items").update(gameData).eq("id", editingGame.id)
        : supabaseClient.from("game_items").insert({ ...gameData, user_id: currentUser.id });

    const { error } = await request;
    if (error) {
        showMessage(error.message);
        return;
    }

    showMessage(editingGame ? "Game changes saved." : "Game added to your library.");
    closeGameForm();
    await loadGameLibrary();
});

function renderSelectedMovie() {
    if (!selectedMovie) {
        selectedMoviePreview.hidden = true;
        return;
    }

    setPoster(
        document.getElementById("selectedMoviePoster"),
        selectedMovie.poster_path,
        `${selectedMovie.title} poster`
    );
    document.getElementById("selectedMovieTitle").textContent = selectedMovie.title;
    document.getElementById("selectedMovieYear").textContent =
        selectedMovie.release_date?.slice(0, 4) || "";
    selectedMoviePreview.hidden = false;
}

function renderMovieSearchResults(results) {
    movieSearchResults.replaceChildren();
    movieSearchResults.hidden = !results.length;

    results.forEach(movie => {
        const option = document.createElement("button");
        option.type = "button";
        option.className = "movie-search-result";
        option.setAttribute("role", "option");

        const image = document.createElement("img");
        image.alt = "";
        image.loading = "lazy";
        setPoster(image, movie.poster_path);

        const text = document.createElement("span");
        text.className = "movie-search-result__text";
        const title = document.createElement("strong");
        title.textContent = movie.title;
        const year = document.createElement("small");
        year.textContent = movie.release_date?.slice(0, 4) || "Year unavailable";
        text.append(title, year);
        option.append(image, text);

        option.addEventListener("click", () => {
            selectedMovie = movie;
            titleInput.value = movie.title;
            movieSearchResults.replaceChildren();
            movieSearchResults.hidden = true;
            movieSearchStatus.textContent = "Poster selected.";
            renderSelectedMovie();
        });

        movieSearchResults.appendChild(option);
    });
}

async function searchMovieTitles(query, sequence) {
    movieSearchStatus.textContent = "Searching TMDB...";
    movieSearchResults.hidden = true;

    const { data, error } = await supabaseClient.functions.invoke("search-movies", {
        body: { query, mediaType: mediaTypeInput.value }
    });

    if (sequence !== movieSearchSequence) return;

    if (error) {
        movieSearchStatus.textContent =
            "Movie search isn't available. Check the Supabase function setup and try again.";
        console.error("TMDB movie search failed:", error);
        return;
    }

    const results = Array.isArray(data?.results) ? data.results : [];
    if (!results.length) {
        movieSearchStatus.textContent = "No matches found. You can still add the title without a poster.";
        return;
    }

    movieSearchStatus.textContent = "Choose the matching title to use its poster.";
    renderMovieSearchResults(results);
}

titleInput.addEventListener("input", () => {
    selectedMovie = null;
    renderSelectedMovie();
    movieSearchResults.replaceChildren();
    movieSearchResults.hidden = true;
    window.clearTimeout(searchTimer);

    const query = titleInput.value.trim();
    if (query.length < 2) {
        movieSearchSequence++;
        movieSearchStatus.textContent = "";
        return;
    }

    const sequence = ++movieSearchSequence;
    searchTimer = window.setTimeout(() => searchMovieTitles(query, sequence), 350);
});

mediaTypeInput.addEventListener("change", () => {
    selectedMovie = null;
    renderSelectedMovie();
    if (titleInput.value.trim().length >= 2) {
        window.clearTimeout(searchTimer);
        const sequence = ++movieSearchSequence;
        searchTimer = window.setTimeout(
            () => searchMovieTitles(titleInput.value.trim(), sequence),
            150
        );
    }
});

document.getElementById("clearMovieSelection").addEventListener("click", () => {
    selectedMovie = null;
    renderSelectedMovie();
    titleInput.dispatchEvent(new Event("input"));
    titleInput.focus();
});

addForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (!currentUser) return;

    const itemData = {
        title: titleInput.value.trim(),
        media_type: mediaTypeInput.value,
        status: statusInput.value
    };
    if (!itemData.title) return;

    if (selectedMovie) {
        Object.assign(itemData, {
            tmdb_id: selectedMovie.id,
            poster_path: selectedMovie.poster_path,
            overview: selectedMovie.overview,
            release_date: selectedMovie.release_date
        });
    } else if (editingItem && editingItem.title === itemData.title &&
        editingItem.media_type === itemData.media_type) {
        Object.assign(itemData, {
            tmdb_id: editingItem.tmdb_id,
            poster_path: editingItem.poster_path,
            overview: editingItem.overview,
            release_date: editingItem.release_date
        });
    } else {
        Object.assign(itemData, {
            tmdb_id: null,
            poster_path: null,
            overview: null,
            release_date: null
        });
    }

    const request = editingItem
        ? supabaseClient.from("watchlist_items").update(itemData).eq("id", editingItem.id)
        : supabaseClient.from("watchlist_items").insert({ ...itemData, user_id: currentUser.id });

    const { error } = await request;
    if (error) {
        showMessage(error.message);
        return;
    }

    showMessage(editingItem ? "Changes saved." : "Added to your collection.");
    closeForm();
    await loadWatchlist();
});

async function deleteItem(id) {
    const { error } = await supabaseClient
        .from("watchlist_items")
        .delete()
        .eq("id", id);

    if (error) {
        showMessage(error.message);
        return;
    }

    showMessage("Item removed.");
    await loadWatchlist();
}

async function deleteGameItem(id) {
    const { error } = await supabaseClient
        .from("game_items")
        .delete()
        .eq("id", id);

    if (error) {
        showMessage(error.message);
        return;
    }

    showMessage("Game removed from your library.");
    await loadGameLibrary();
}

function showDetails(item) {
    document.getElementById("detailsKicker").textContent = "Movie Details";
    document.getElementById("detailsTitle").textContent = item.title;
    document.getElementById("detailsDescription").textContent = [
        `${item.media_type === "tv" ? "TV Series" : "Film"} · ${
            item.status === "watched" ? "Watched" :
                item.status === "watching" ? "Currently watching" : "Plan to watch"
        }`,
        item.release_date ? item.release_date.slice(0, 4) : ""
    ].filter(Boolean).join(" · ") + (item.overview ? `\n\n${item.overview}` : "");
    setPoster(
        document.getElementById("detailsPoster"),
        item.poster_path,
        `${item.title} poster`
    );
    detailsDialog.showModal();
}

function showGameDetails(game) {
    document.getElementById("detailsKicker").textContent = "Game Details";
    document.getElementById("detailsTitle").textContent = game.title;
    document.getElementById("detailsDescription").textContent = [
        `Video game · ${gameStatusLabel(game.status)}`,
        game.release_date ? game.release_date.slice(0, 4) : ""
    ].filter(Boolean).join(" · ") + (game.description ? `\n\n${game.description}` : "");
    setGameCover(
        document.getElementById("detailsPoster"),
        game.cover_url,
        `${game.title} cover`
    );
    detailsDialog.showModal();
}

document.getElementById("detailsButton").addEventListener("click", () => {
    if (featuredItem) showDetails(featuredItem);
});
document.getElementById("editButton").addEventListener("click", () => {
    if (featuredItem) openForm(featuredItem);
});
document.getElementById("viewAllButton").addEventListener("click", () => {
    searchInput.value = "";
    setView("lists");
});
suggestFilmButton.addEventListener("click", () => {
    const candidates = items.filter(item => item.status !== "watched" && item.media_type === "movie");
    if (!candidates.length) {
        showMessage("There are no unwatched films in your watchlist to suggest.");
        return;
    }

    showMessage("");
    const suggestion = candidates[Math.floor(Math.random() * candidates.length)];
    showDetails(suggestion);
});
function suggestGame(status) {
    const candidates = gameItems.filter(game => game.status === status);
    if (!candidates.length) {
        showMessage(`There are no ${status === "planned" ? "games you want to play" : "games in progress"} to suggest.`);
        return;
    }

    showMessage("");
    const suggestion = candidates[Math.floor(Math.random() * candidates.length)];
    showGameDetails(suggestion);
}
suggestPlannedGameButton.addEventListener("click", () => suggestGame("planned"));
suggestPlayingGameButton.addEventListener("click", () => suggestGame("playing"));
document.getElementById("closeDetailsButton").addEventListener("click", () => detailsDialog.close());
document.getElementById("detailsDoneButton").addEventListener("click", () => detailsDialog.close());

checkUser();
