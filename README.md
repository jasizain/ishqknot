# ishqknot
## Photo admin (`/admin.html`)

The portfolio photos are managed from `https://<your-site>/admin.html`: add, replace, reorder,
retitle, recategorise, adjust crop and delete. Changes go live when you press **Save changes**.
Uploads and the saved list are stored in a Cloudflare R2 bucket (see `src/worker.js`);
`photos.json` is the starting list used until the first save.

One-time setup:

1. `npx wrangler r2 bucket create ishqknot-photos`
2. `npx wrangler secret put ADMIN_PASSWORD` (choose a long password, give it only to the admin)
3. `npx wrangler deploy`
