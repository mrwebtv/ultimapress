import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "site_settings" ALTER COLUMN "primary_color" SET DEFAULT '#7B2BFF';
  ALTER TABLE "site_settings" ALTER COLUMN "accent_color" SET DEFAULT '#F21CD9';`)
  // Sites still on the old default colours move to the new brand colours.
  // Colours someone chose themselves are left alone.
  await db.execute(sql`
   UPDATE "site_settings" SET "primary_color" = '#7B2BFF' WHERE upper("primary_color") = '#188BF6';
  UPDATE "site_settings" SET "accent_color" = '#F21CD9' WHERE upper("accent_color") = '#C6F432';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "site_settings" ALTER COLUMN "primary_color" SET DEFAULT '#188BF6';
  ALTER TABLE "site_settings" ALTER COLUMN "accent_color" SET DEFAULT '#C6F432';`)
}
