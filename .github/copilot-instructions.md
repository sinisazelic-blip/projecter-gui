# AI Coding Assistant Instructions for proJECTer GUI

## Architecture Overview
This is a Next.js 16 application managing project finances for Studio TAF. It connects to a DigitalOcean MySQL database (`studio_db`) via mysql2. The app uses App Router with server components and actions for data operations.

**Key directories:**
- `src/app/api/` - API routes (GET/POST handlers)
- `src/lib/db.ts` - Database connection pool and query helpers
- `src/components/` - Reusable UI components
- `docs/` - API contracts, DB schema, and state documentation

## API Patterns
- **Response format:** `{ok: true, ...data}` for success, `{ok: false, error: "..."}` for errors
- Use `lib/api/response.ts` helpers: `ok(data)` and `fail(code, message)`
- Wrap handlers with `withApiErrorBoundary` from `lib/api/routeWrap.ts`
- Database access: Prefer `query()` from `lib/db.ts` over direct connections
- Add `export const dynamic = "force-dynamic"` to prevent caching

**Example API route structure:**
```typescript
import { query } from "@/lib/db";
import { ok, fail } from "@/lib/api/response";

export async function GET() {
  try {
    const data = await query("SELECT * FROM table");
    return ok({ data });
  } catch (e) {
    return fail("DB_ERROR", "Database query failed");
  }
}
```

## Database Conventions
- Currency displayed as **KM** throughout UI (backend may store BAM/EUR)
- Use `withTransaction()` helper for multi-statement operations
- Date formatting: `DATE_FORMAT(date_col, '%Y-%m-%d')` in queries
- Foreign keys: `klijent_id`, `projekat_id`, `tip_id` etc.

## Component Patterns
- Server components for data fetching, client components for interactivity
- Use server actions for form submissions: `"use server"` functions
- Formatting helpers: `fmtKM()` for currency, `fmtDate()` for dd.mm.yyyy display
- `ReadOnlyGuard` component to disable editing for archived projects
- `ConfirmSubmitButton` for destructive actions with confirmation

**Example server action:**
```javascript
async function addCost(formData) {
  "use server";
  const projekatId = Number(formData.get("projekat_id"));
  // validation...
  await query("INSERT INTO projektni_troskovi ...", [params]);
  revalidatePath(`/projects/${projekatId}`);
}
```

## Development Workflow
- **Lint/format:** `npm run lint` (Biome), `npm run format`
- **Database:** Ensure env vars: `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- **Debugging:** Check `src/app/api/debug/` routes for DB inspection
- **Compatibility:** Some routes return multiple response formats (`rows`, `projects`, `data`) for legacy frontend support

## Key Files to Reference
- `docs/API_CONTRACTS.md` - API endpoint specifications
- `docs/DB_MAP.md` - Database schema and relationships
- `docs/STATE.md` - App modules and state management
- `src/lib/db.ts` - Database utilities
- `src/lib/api/response.ts` - Response helpers</content>
<parameter name="filePath">c:\Users\Studio TAF\OneDrive\Desktop\projecter-gui\.github\copilot-instructions.md