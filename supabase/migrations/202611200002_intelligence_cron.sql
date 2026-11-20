begin;
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('adme-intelligence-daily', '*/5 * * * *', 'select adme_ops.daily_tick()');
commit;
