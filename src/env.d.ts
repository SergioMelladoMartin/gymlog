/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    user: {
      id: string;
      name: string;
      email: string;
      emailVerified: boolean;
      image?: string | null;
    } | null;
    session: {
      id: string;
      userId: string;
      expiresAt: Date;
      token: string;
    } | null;
  }
}

interface ImportMetaEnv {
  readonly TURSO_DATABASE_URL?: string;
  readonly TURSO_AUTH_TOKEN?: string;
  readonly BETTER_AUTH_SECRET?: string;
  readonly BETTER_AUTH_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
