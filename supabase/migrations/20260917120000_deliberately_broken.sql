-- FA-1.11 red proof. Deliberately broken: table "nope" does not exist.
-- This branch exists only to show the `db` job going red; it is never merged.
ALTER TABLE nope ADD COLUMN x int;
