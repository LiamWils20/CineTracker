# Movie poster lookup setup

Movie and TV title search uses TMDB through a Supabase Edge Function. The TMDB access token stays on Supabase and is never sent to the browser.

1. Create a TMDB account and request an API **Read Access Token** from the TMDB API settings.
2. From the project directory, link the Supabase project and apply the database migration:

   ```powershell
   supabase login
   supabase link --project-ref lxnefknbnyqjsqbelqkc
   supabase db push
   ```

3. Store the TMDB token as a Supabase secret and deploy the search function:

   ```powershell
   supabase secrets set TMDB_API_READ_ACCESS_TOKEN=your_tmdb_read_access_token
   supabase functions deploy search-movies
   ```

After deployment, the Add Movie form searches titles as they are typed. Select the matching movie or show to attach its poster and details. Titles can still be saved without a match or poster.

The database migration adds nullable TMDB metadata columns to `public.watchlist_items`, so existing entries remain valid. This product uses the TMDB API but is not endorsed or certified by TMDB.

## Games library

Games are stored in the separate `public.game_items` table, not alongside movies and TV shows in `public.watchlist_items`. Game search, covers, and details use IGDB through a Supabase Edge Function. Twitch credentials stay on Supabase and are never sent to the browser.

1. Create a Twitch account, enable two-factor authentication, and register a **Confidential** application in the [Twitch Developer Portal](https://dev.twitch.tv/console/apps). Use `localhost` as the OAuth Redirect URL, then copy the app's Client ID and generate a Client Secret. See the [IGDB API getting-started guide](https://api-docs.igdb.com/).
2. Apply the database migrations:

   ```powershell
   supabase db push
   ```

3. Store the Twitch credentials as Supabase secrets and deploy the game search function:

   ```powershell
   supabase secrets set IGDB_CLIENT_ID=your_twitch_client_id IGDB_CLIENT_SECRET=your_twitch_client_secret
   supabase functions deploy search-games
   ```

The Games section has its own search, statuses (Want to play, Currently playing, and Completed; stored as `planned`, `playing`, and `completed`), and add/edit/remove controls. See the [IGDB documentation](https://api-docs.igdb.com/) and [Twitch Developer Agreement](https://www.twitch.tv/p/legal/developer-agreement/) for API usage terms.
