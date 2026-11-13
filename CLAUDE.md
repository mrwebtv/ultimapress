# UltimaPress: notes for Claude

UltimaPress is a WordPress alternative built on Payload CMS 3 and Next.js. The site owner
asks you to add features in plain English. Build them directly into this codebase, the way
WordPress users would install a plugin, but cleaner: no plugin layer, one codebase.

Payload reference: `.claude/skills/payload/SKILL.md`, then `.claude/skills/payload/reference/`.

## Map of the project

| Where | What |
| --- | --- |
| `src/payload.config.ts` | Registers every collection, global, plugin, endpoint, admin branding, email |
| `src/collections/` | Pages, Posts, Media, Categories, Tags, Comments, Users |
| `src/globals/SiteSettings.ts` | General, Design, Reading, Features, Maintenance, Privacy settings |
| `src/Header/`, `src/Footer/` | Menus (globals) and their front-end components |
| `src/blocks/` | Page builder blocks. Each has `config.ts` (fields) and `Component.tsx` (front end) |
| `src/blocks/RenderBlocks.tsx` | Maps block slugs to components |
| `src/heros/` | Page hero variants |
| `src/access/roles.ts` | Roles (admin, editor, author) and access helpers |
| `src/importer/wordpress.ts` | WordPress (WXR) importer |
| `src/endpoints/wordpressImport.ts` | `/api/wp-import` and `/api/site-export` |
| `src/proxy.ts` | Site-wide redirects (including imported WordPress URLs) |
| `src/plugins/index.ts` (mcpPlugin) | "Connect Claude": what Claude can read and change through a connection |
| `src/mcp/tools.ts` | Extra tools for connected Claude (writePost, writePage, addImage) and its instructions |
| `src/endpoints/siteRefresh.ts` | Refreshes the public site after every change connected Claude makes (all collections and globals) |
| `src/endpoints/claudeConnect.ts` | One-click connection from the dashboard |
| `src/components/admin/Spine/` | The Spine: the admin menu (replaces Payload's Nav) |
| `src/components/admin/BuildFeature/` | The "Build a feature" admin page (`/admin/build-a-feature`) |
| `src/components/admin/SiteCode/` | The "Site code" admin page (`/admin/site-code`): download the code, upload a new version, go back |
| `src/endpoints/siteCode.ts`, `src/siteCode/` | `/api/site-code/*`: admin only, password asked again for anything that changes the live site |
| `docker/supervisor.mjs` | Runs the site in Docker and replaces its code safely (backup, build, check, switch, roll back) |
| `scripts/ship.mjs` | `pnpm ship`: sends this folder to the owner's site, where it waits for their password |
| `src/app/(frontend)/` | Public website routes |
| `src/app/(frontend)/globals.css` | Theme tokens and the four templates (`html[data-template=...]`) |
| `src/utilities/getSiteSettings.ts` | Read settings on the front end (cached, with safe defaults) |
| `src/migrations/` | Database migrations. Run automatically when the production app starts |

## Rules that keep the site working

1. **Every schema change needs a migration.** After adding or changing a field, collection
   or global, run:
   ```
   pnpm generate:types
   pnpm payload migrate:create <short-name>
   ```
   Commit the new files in `src/migrations/`. Production applies them on start. Without a
   migration the live site will error on the new field.
2. **After adding admin components** (anything referenced by a string path such as
   `'@/components/...'`), run `pnpm generate:importmap`.
3. **Access control on everything.** Use the helpers in `src/access/roles.ts`. Public
   create access is only for things like comments and form submissions, and those need
   spam protection (see the honeypot in `src/collections/Comments.ts`).
4. **Feature toggles live in Site Settings > Features.** Optional features are off by
   default; read them with `getSiteSettings()` and render nothing when off.
5. **Styling uses theme tokens**, never hard-coded colours: `var(--up-primary)`,
   `var(--up-accent)`, `var(--radius)`, Tailwind classes like `bg-card`, `border-border`,
   `text-muted-foreground`, and the helpers `.up-btn`, `.up-link`, `.up-heading`. That way
   every feature works in all four templates and with the owner's colours.
6. **The Docker image builds without a database.** Any `generateStaticParams` must return
   `[]` when `process.env.UP_SKIP_STATIC === '1'`, and front-end code that reads settings
   should go through `getSiteSettings()`.
7. **Revalidate after changes.** Collections that appear on the front end need an
   `afterChange` hook calling `revalidatePath` / `revalidateTag` (see Pages and Posts).
8. Run `npx tsc --noEmit` before finishing. Keep the WordPress importer working if you
   touch Posts, Pages, Categories, Tags or Comments.
9. **The Spine (admin menu) is driven by `admin.group`.** Give every collection and global
   one of these groups: `'Write'` (content), `'Media'`, `'Design'` (look, menus), `'Grow'`
   (visitors, forms, SEO), `'Build'` (Claude tools) or `'Settings'` (behind the gear). A new
   feature's own collections go in `'Your features'` (any other group lands there too).
   Never add sidebar links by hand.

10. When you add a collection or global that site owners would want Claude to manage from
   the Claude app, add it to `mcpPlugin` in `src/plugins/index.ts` and to the operations in
   `src/endpoints/claudeConnect.ts`, then generate types and a migration. A new tool in
   `src/mcp/tools.ts` also needs switching on in `claudeConnect.ts`, plus types and a migration.

## Putting changes live

When the owner says "put it live" (or "ship it", "publish my changes"):

1. Run `npx tsc --noEmit` and fix anything it reports. A version that does not build is
   refused by the site, so check first.
2. Run `pnpm ship` (or `node scripts/ship.mjs`). It packs this folder and sends it to their
   site. If it says no site is set up, ask the owner to open **Build > Site code** in their
   admin, create a deploy key and give you the line it shows, then run that line.
3. Tell the owner to open **Site code** in their admin and confirm with their password.
   Nothing is live until they do. The site backs up their content, builds the new version
   and switches to it only if it starts.

If the Site code page shows that an update did not go live, ask the owner for the text under
"What happened", fix the cause and ship again. Never ask for, store or send the owner's
admin password, and never commit `.ultimapress-deploy.json`.

## Recipes

**Add a page builder block**
1. `src/blocks/<Name>/config.ts` with a `Block` (`slug`, `interfaceName`, `fields`).
2. `src/blocks/<Name>/Component.tsx`, typed with the generated interface from
   `@/payload-types`. Wrap content in `<section className="container">`.
3. Add it to the `blocks` array in `src/collections/Pages/index.ts` and to
   `blockComponents` in `src/blocks/RenderBlocks.tsx`.
4. Generate types and a migration.

**Add a new content type** (events, team members, services, listings…)
1. New collection in `src/collections/`, add to `collections` in `payload.config.ts`.
2. Front-end routes in `src/app/(frontend)/<name>/` (list page and `[slug]` page).
3. Access with the role helpers, an `admin.group` (see rule 9), drafts if it is
   public content.
4. Add it to the sitemap and search if visitors should find it.
5. Generate types and a migration.

**Add a setting** to `src/globals/SiteSettings.ts` (pick the right tab), add a default in
`src/utilities/getSiteSettings.ts`, then generate types and a migration.

**Send email** with `req.payload.sendEmail({ to, subject, html })`. It uses the SMTP
settings in `.env` (or logs to the console when none are set).

## Commands

```
pnpm dev                 # local development (needs DATABASE_URL to a Postgres)
pnpm generate:types      # after any schema change
pnpm payload migrate:create <name>
pnpm generate:importmap  # after adding admin components
npx tsc --noEmit         # type check
pnpm ship                # send this folder to the owner's site (they confirm in Site code)
./update.sh               # on the server (sites installed from the files): back up, then rebuild
```
