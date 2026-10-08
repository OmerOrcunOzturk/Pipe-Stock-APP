# BoruStok (Pipe Stock App)

A web application for tracking the stock of drinking-water and corrugated
pipes distributed to villages. It runs on a single computer inside the
organisation; other computers connect to it from a browser. It needs no
internet connection, no cloud service and no Docker.

The user interface is in Turkish.

## What it does

- **Stock receipts:** records pipes arriving at the warehouse, in pieces and
  metres.
- **Distributions:** records pipes handed to a village; stock is reduced
  automatically and more than what is in the warehouse cannot be given out.
- **Request forms:** for every distribution, downloads the warehouse request
  form (Ambar Talep Formu) and the material request slip (Malzeme Talep Fişi)
  as Excel files, filled in on the organisation's own template with the
  village, date, village headman (muhtar) and pipe lines.
- **Count adjustments and cancellations:** records are never deleted; a wrong
  document is cancelled with a reversing entry, so history stays traceable.
- **Reports:** distribution per village, summary per pipe type and a movement
  list, all exportable to Excel.
- **Roles:** admin (everything), warehouse clerk (receipts and distributions),
  viewer (read-only).
- **Audit log:** every change to definitions and users is stored together
  with who made it.

## How it works

```
Browser (office computers, phones)
        │  http://SERVER-IP:8080
        ▼
server/sunucu.mjs  ──  application files (dist/)
        │              sign-in and sessions (/auth/v1)
        ▼
PostgREST  ──  data API (/rest/v1)
        ▼
PostgreSQL ──  tables, permissions (RLS), stock rules
```

All business rules (stock sufficiency, permissions, duplicate-request
protection) live in the database; the interface cannot bypass them.

| Layer | Technology |
|---|---|
| Interface | React 19, TypeScript, Vite, Tailwind CSS, TanStack Query |
| Data access | supabase-js → PostgREST |
| Database | PostgreSQL 15+ (row-level security and PL/pgSQL functions) |
| Server | Node.js 22+, no external packages |
| Excel | ExcelJS |

## Installation

Step-by-step installation on the server computer is described in
[server/KURULUM.md](server/KURULUM.md) (in Turkish). In short:

1. Install Node.js and PostgreSQL.
2. Download PostgREST and place it in `server/bin/`.
3. Build the application with `npm run build`.
4. `node server/kur.mjs` sets up the database and creates the first admin.
5. `node server/sunucu.mjs` serves the application on the network.

On Windows, `KUR.bat` performs step 4 and everything after it in one go; it
also sets up start-on-boot, a daily backup and the firewall rule.

## Development

```bash
npm install
npm run kur       # sets up the local database (needs PostgreSQL and PostgREST)
npm run sunucu    # server on port 8080
npm run dev       # interface on port 5173; proxies data requests to the server
```

| Command | Purpose |
|---|---|
| `npm run build` | Type check and production build (`dist/`) |
| `npm run typecheck` | Type check only |
| `npm run lint` | oxlint |
| `npm run yedekle` | Takes a database backup |

### Folders

| Folder | Contents |
|---|---|
| `src/features/` | Screens, organised by feature (stock, distributions, reports, users …) |
| `src/features/distributions/templates/` | Excel templates for the request forms |
| `supabase/migrations/` | Database schema; the setup program applies the files in order |
| `supabase/tests/` | SQL tests for the database rules |
| `server/` | Local server, setup and backup programs |

The `supabase` folder name is a leftover from the project's start on
Supabase. The local server exposes the same API, so the schema files and the
interface code are used unchanged.

## Frequently asked questions

### General

**Does it need the internet?**
No. Apart from downloading the programs during installation, the internet is
not used. Data never leaves the organisation.

**Does anything need to be installed on the other computers?**
No. They open the server's address in a browser. A desktop shortcut can be
added if wanted.

**Can it be used from a phone?**
Yes, if the phone is on the organisation's network (Wi-Fi). The interface
adapts to small screens.

**How powerful does the server computer need to be?**
An ordinary office computer is enough. The three parts together use about
300 MB of RAM; it runs comfortably on a computer with 4 GB. The same computer
can stay in everyday use.

**How many people can use it at the same time?**
For an office there is no practical limit. If two people try to distribute
the same pipe at the same moment, the database queues the two requests; stock
never goes negative.

**What happens while the server is switched off?**
The application does not open. When the server is switched on again it
continues where it left off; no data is lost.

### Data and security

**Where is the data stored?**
In the PostgreSQL database on the server computer. It is not sent anywhere
else.

**How are backups taken?**
`KUR.bat` schedules an automatic backup every day at 12:30; backups are
written to the `yedekler/` folder and the latest 30 are kept. To protect
against disk failure, point the backup folder at another disk or a network
share (see KURULUM.md).

**Is the connection encrypted?**
No, it uses plain `http`. The application should therefore be used only on
the internal network, and the server port must not be exposed to the
internet. If access from the internet is needed, put a reverse proxy that
provides HTTPS in front of it.

**How are passwords stored?**
As bcrypt hashes. Nobody, including admins, can see existing passwords; an
admin can only set a new one. Repeated failed sign-ins are temporarily
blocked.

**A record was entered wrongly. Can it be deleted?**
Stock documents are not deleted, they are cancelled: the document stays in
the list marked as cancelled and its effect on stock is reversed. Pipe types
and villages that were never used can be deleted; used ones are deactivated.

**What if the admin password is forgotten?**
Another admin resets it under Tanımlar → Kullanıcılar. If no admin is left,
the password is reset directly in the database on the server computer.

### Excel forms

**Can I use my own organisation's forms?**
Yes. The templates in the repository are examples and the signature names are
placeholders. Put your own files, with the same names, in
`src/features/distributions/templates/ozel/` and rebuild; the application
uses the files in that folder. The folder is not committed to the
repository.

**What if my template has a different layout?**
Which cell receives which value is defined in the `layouts` table in
[`talepForms.ts`](src/features/distributions/talepForms.ts) (sheet name, the
village/date/headman cells, the first pipe row and the columns). If your
layout differs, updating that table is enough.

**What happens to the other sheets in the template?**
They are left untouched. Only the defined sheets are filled in; the other
sheets keep their cells, formatting and print layout exactly.

**What if a distribution has more lines than the template has rows?**
No file is produced and a warning is shown; a form is never printed with
missing lines.

### Technical

**Why no Docker?**
The target environment is office computers where Docker cannot be installed
and cloud services cannot be used. Every part is therefore installed as an
ordinary program.

**Can it be used with Supabase?**
Yes. If `supabase/migrations` is applied to a Supabase project and
`VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are defined in
`.env.local`, the interface connects to that project. Only the screen for
adding users and resetting passwords will not work (those functions are
specific to the local server); users are added from the Supabase dashboard
instead.

**Does it run on Linux?**
Yes, the server programs are platform-independent and were tested on Linux.
`KUR.bat` and `otomatik-baslat.ps1` are Windows-only; on Linux you need to
write a systemd unit for start-on-boot.

**How is it updated?**
Copy the new `dist/`, `server/` and `supabase/migrations/` to the server and
run the setup program again. It applies only new schema changes and does not
touch existing data.

**How do I add a database change?**
Add a new date-prefixed `.sql` file to `supabase/migrations/`. Files that
have already been applied are not edited; the setup program tracks which ones
have been applied.

## Known limitations

- `KUR.bat` and `otomatik-baslat.ps1` are written but have not yet been tried
  on a real Windows computer.
- Users cannot change their own password; an admin sets it.
- The interface is available in Turkish only.

## License

No license has been added yet. Until one is added, the code may be read, but
all rights to use, modify and distribute it are reserved.
