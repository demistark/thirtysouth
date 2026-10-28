# Fix: scripture is readable by signed-out visitors

## Finding
The `chapters` table lets anyone (signed out included) read every column, `scripture_ref` and `scripture_text` too. The column restriction that was meant to hide them is not in place, so the `chapter_scriptures()` gate can be skipped by querying the table directly.

## Change
- Remove table-wide read access on `chapters` for visitors and signed-in users, then allow reading only: number, date, title, summary, photo_url, sort_order.
- Check that the itinerary page selects only those columns (not `*`), and that scripture still loads for friends through `chapter_scriptures()`.
- Re-run the column check: visitors and signed-in users get `false` for both scripture columns.

Nothing else changes.
