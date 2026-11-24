import { createId } from '@/domain/id';
import type { User } from '@/domain/user';

import type { SqlDatabase } from '../database';

type UserRow = { id: string; display_name: string; email: string | null; created_at: number };

const toUser = (row: UserRow): User => ({
  id: row.id,
  displayName: row.display_name,
  email: row.email,
  createdAt: row.created_at,
});

export function createUserRepository(db: SqlDatabase, now: () => number = Date.now) {
  return {
    async findById(id: string): Promise<User | null> {
      const row = await db.getFirstAsync<UserRow>('SELECT * FROM users WHERE id = ?', [id]);
      return row ? toUser(row) : null;
    },

    async findByEmail(email: string): Promise<User | null> {
      const row = await db.getFirstAsync<UserRow>(
        'SELECT * FROM users WHERE lower(email) = lower(?)',
        [email],
      );
      return row ? toUser(row) : null;
    },

    async findFirst(): Promise<User | null> {
      const row = await db.getFirstAsync<UserRow>(
        'SELECT * FROM users ORDER BY created_at ASC LIMIT 1',
      );
      return row ? toUser(row) : null;
    },

    async create(input: { displayName: string; email: string | null }): Promise<User> {
      const user: User = {
        id: createId(),
        displayName: input.displayName,
        email: input.email,
        createdAt: now(),
      };
      await db.runAsync(
        'INSERT INTO users (id, display_name, email, created_at) VALUES (?, ?, ?, ?)',
        [user.id, user.displayName, user.email, user.createdAt],
      );
      return user;
    },
  };
}

export type UserRepository = ReturnType<typeof createUserRepository>;
