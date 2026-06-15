-- Check for any character_states rows with stress outside 0-5
SELECT cs.id, cs.stress, c.name
FROM character_states cs
LEFT JOIN characters c ON c.id = cs.id
WHERE cs.stress < 0 OR cs.stress > 5
ORDER BY cs.stress DESC;

-- Also show distribution
SELECT stress, COUNT(*) as cnt
FROM character_states
GROUP BY stress
ORDER BY stress;
