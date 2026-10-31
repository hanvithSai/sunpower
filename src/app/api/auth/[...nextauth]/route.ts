/** Auth.js endpoints (/api/auth/session, /api/auth/callback/credentials, ...). */
import { handlers } from "@/server/auth/config";

export const { GET, POST } = handlers;
