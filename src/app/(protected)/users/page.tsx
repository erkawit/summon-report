import { redirect } from 'next/navigation';
import { ensureDb } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import UsersClient from '@/components/UsersClient';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const user = await getSessionUser();
  if (!user || user.role !== 'admin') redirect('/dashboard');

  const sql = await ensureDb();
  const rows = await sql`SELECT id, username, full_name, position, address, role, is_active FROM users ORDER BY id ASC`;

  return (
    <UsersClient
      curUserId={user.id}
      initialUsers={rows.map((u) => ({
        id: Number(u.id),
        username: String(u.username),
        full_name: String(u.full_name),
        position: String(u.position || ''),
        address: String(u.address || ''),
        role: u.role === 'admin' ? 'admin' : 'user',
        is_active: Boolean(u.is_active),
      }))}
    />
  );
}
