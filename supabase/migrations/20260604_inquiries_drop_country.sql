-- Make angler_country nullable (field removed from inquiry form)
alter table inquiries
  alter column angler_country drop not null;
