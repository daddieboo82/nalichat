# Advanced message search

Message search is scoped to one conversation. Authenticated members can use basic
case-insensitive text search for free; text matches message text, sender display name,
or attachment file name. The canonical `search.advanced` entitlement unlocks
composable sender, date-range, and content-type filters (`text`, `image`, `audio`,
`file`, and `session`) plus newest/oldest ordering.

The `searchMessages` function verifies membership from the server-side Conversation
record before querying with service-role access. It never accepts participant IDs as
authorization and returns only fields needed to render a result. Start timestamps are
inclusive and end timestamps are exclusive; the client converts local calendar days
to explicit ISO-8601 timezone-aware boundaries.

## Base44 query limits

Base44 entity search does not expose a native full-text index or a stable compound
cursor for `created_date` plus `id`. The function therefore:

- always pushes conversation, single sender/type, and date constraints into the
  entity query;
- scans at most 500 candidate rows per request for case-insensitive text and
  multi-type matching;
- returns at most 50 results and caps offsets at 10,000; and
- uses documented offset pagination. Inserts or deletes before the active offset can
  shift later pages, and identical timestamps can move across page boundaries.

If a bounded text scan finds no matches but more candidates remain, the UI offers to
continue into the next result window. Searches stop at the offset cap and report a
truncated page. Large conversations should add a dedicated normalized search index
before raising these bounds.
