import { NextRequest } from 'next/server';
import { verifySessionToken, COOKIE_NAME } from './auth';
import { db } from './db';

export async function getAuthenticatedUser(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = verifySessionToken(token);
  if (!payload) return null;
  const user = await db.user.findUnique({ where: { id: payload.id } });
  return user;
}
