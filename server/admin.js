// Admin-Seite (/admin): Statistik der gespielten Partien – gemeinsam für Node-Server und Cloudflare-Worker.
// Die Einträge liefert die Lobby (onGame); gespeichert werden sie je Plattform in data/games.json bzw. SQLite.

/**
 * Darf diese Anfrage auf die Admin-Schnittstelle zugreifen?
 * Ohne gesetztes ADMIN_KEY ist die Seite nur „versteckt“, nicht geschützt.
 */
export function adminAllowed(expected, given) {
  if (!expected) return true;
  const a = String(expected);
  const b = String(given ?? '');
  let diff = a.length ^ b.length;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

/**
 * Gespeicherte Einträge um den aktuellen Stand ergänzen, neueste zuerst:
 * „live“ (jemand sitzt am Tisch), „paused“ (gespeichert, niemand da), „ended“ oder „abandoned“.
 */
export function gameStats(records, rooms, now = Date.now()) {
  const games = records.map((r) => {
    if (r.endedAt) return { ...r, status: 'ended' };
    const room = rooms.get(r.code);
    if (!room?.game || room.gameId !== r.id) return { ...r, status: 'abandoned' };
    const live = room.seats.some((s) => !s.isBot && s.conn);
    return { ...r, status: live ? 'live' : 'paused', rounds: room.game.turn.round, lastActive: room.lastActive };
  });
  games.sort((a, b) => b.startedAt - a.startedAt);
  return { now, games };
}
