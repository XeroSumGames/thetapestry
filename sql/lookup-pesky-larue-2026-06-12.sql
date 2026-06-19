SELECT id, username, email, role FROM profiles WHERE lower(username) LIKE '%pesky%' OR lower(username) LIKE '%larue%';
