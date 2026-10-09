-- Badminton and pickleball courts are courts, not halls: "Court D1" in Hall D,
-- as the committee's sheet calls them (Hall D, Court 1). "Hall D1" read as a
-- hall of its own. Hall A and Hall B stay: each is a whole hall.
update courts
  set name = 'Court ' || substring(name from 6)
  where name ~ '^Hall [CD][0-9]+$';
