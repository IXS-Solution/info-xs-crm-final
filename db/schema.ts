import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const records = sqliteTable('crm_records',{id:text('id').primaryKey(),kind:text('kind').notNull(),data:text('data').notNull(),version:integer('version').notNull().default(1)});
export const config = sqliteTable('crm_config',{key:text('key').primaryKey(),value:text('value').notNull()});
