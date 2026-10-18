-- The Chilli Tales take pre-orders by Instagram DM; their handle is already
-- on the card, so the contact line need not repeat it.
update vendors set contact = 'Pre-order: send them a DM' where name = 'The Chilli Tales';
