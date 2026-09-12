const SQUAD_MEMBERSHIP_PAGE_SIZE = 200;

export function isSquadInviteExpired(squad: any): boolean {
  const raw = squad?.invite_expires_at || squad?.created_date;
  if (!raw) return false;
  const base = Date.parse(raw);
  if (Number.isNaN(base)) return false;
  const expiry = squad?.invite_expires_at ? base : base + 7 * 24 * 60 * 60 * 1000;
  return expiry <= Date.now();
}

export async function findBlockingSquadMembership(
  entities: any,
  userId: string,
): Promise<any | null> {
  for (const field of ['member_a_id', 'member_b_id']) {
    for (let skip = 0; ; skip += SQUAD_MEMBERSHIP_PAGE_SIZE) {
      const rows = await entities.Squad.filter(
        { [field]: userId },
        '-created_date',
        SQUAD_MEMBERSHIP_PAGE_SIZE,
        skip,
      );

      for (const squad of rows) {
        if (squad.status === 'ended') {
          await entities.User.updateMany(
            { id: userId, squad_membership_id: squad.id },
            { $set: { squad_membership_id: null } },
          );
          continue;
        }

        if (squad.status === 'pending' && isSquadInviteExpired(squad)) {
          await entities.Squad.update(squad.id, { status: 'ended' });
          await entities.User.updateMany(
            { id: userId, squad_membership_id: squad.id },
            { $set: { squad_membership_id: null } },
          );
          continue;
        }

        return squad;
      }

      if (rows.length < SQUAD_MEMBERSHIP_PAGE_SIZE) break;
    }
  }

  return null;
}
