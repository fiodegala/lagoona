# Project rules

- Cashback reminders are generated in the database by a trigger on `pos_sales` (`upsert_cashback_reminder`), snapshotting the rules at sale time (old sales get reminders on demand via `create_cashback_reminders_from_sales`, marked `source='sale_manual'`); the popup only reads `cashback_reminders` and marks status via the `set_cashback_reminder_status` RPC — why: every sale path (PDV, edits, cancellations) is covered without touching client sale code.
- Store scope: `user_roles.store_id` is the primary store; extra stores a manager runs live in `user_extra_stores`, and RLS/app code use `user_store_ids()` / `managedStoreIds` for "my stores" — why: managers can run several stores without duplicating role rows.
