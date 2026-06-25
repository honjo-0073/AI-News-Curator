alter table user_settings
add column if not exists fetch_trigger_settings jsonb not null default '{
  "enabled": false,
  "daysOfWeek": [],
  "last_run_date": null
}'::jsonb;

alter table user_settings
add column if not exists send_trigger_settings jsonb not null default '{
  "enabled": false,
  "daysOfWeek": [],
  "last_run_date": null
}'::jsonb;
