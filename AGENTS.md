# Project rules

- Cashback reminders are generated in the database by a trigger on `pos_sales` (`upsert_cashback_reminder`), snapshotting the rules at sale time; the popup only reads `cashback_reminders` and marks status via the `set_cashback_reminder_status` RPC — why: every sale path (PDV, edits, cancellations) is covered without touching client sale code.
