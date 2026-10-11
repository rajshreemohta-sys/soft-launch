-- One article can be relevant to two accounts (e.g. "Blinkit beats Zepto"), so
-- "already seen" and "already a signal" are tracked per account, not globally.

alter table seen_articles drop constraint seen_articles_pkey;
alter table seen_articles alter column account_id set not null;
alter table seen_articles add primary key (account_id, url);
drop index if exists seen_articles_account_idx;

alter table signals drop constraint signals_source_url_key;
alter table signals add constraint signals_account_source_url_key unique (account_id, source_url);
