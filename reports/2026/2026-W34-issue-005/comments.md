# Comments — Issue 005 (2026-W34)

Write freely. Anything marked `@comment` is harvested into `data/issue_comments.csv`
by `npm run comments:scan`, and next week's issue has to answer it before it writes
anything else. A comment is attributed to the nearest heading above it, so putting it
under the right heading is the only addressing needed.

Two forms, both equivalent:

    <!-- @comment Why is this layer core rather than adjacent? -->

    @comment: Why is this layer core rather than adjacent?

This file is created once and never rewritten by the build. Comments in report.md
are also picked up, but that file IS regenerated, so anything left there is lost on
the next rebuild unless it has been scanned first.

---
