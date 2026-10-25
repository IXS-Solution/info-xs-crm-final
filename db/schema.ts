import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const records = sqliteTable('crm_records',{id:text('id').primaryKey(),kind:text('kind').notNull(),data:text('data').notNull(),version:integer('version').notNull().default(1)});
export const config = sqliteTable('crm_config',{key:text('key').primaryKey(),value:text('value').notNull()});
export const users = sqliteTable('crm_users', {
 id:text('id').primaryKey(), email:text('email').notNull().unique(), name:text('name').notNull(),
 role:text('role',{enum:['admin','member']}).notNull().default('member'),
 status:text('status',{enum:['invited','active','disabled']}).notNull().default('invited'),
 passwordHash:text('password_hash'), invitationHash:text('invitation_hash').unique(), invitationExpires:integer('invitation_expires'),createdAt:integer('created_at').notNull()
});
export const sessions = sqliteTable('crm_sessions', {tokenHash:text('token_hash').primaryKey(),userId:text('user_id').notNull().references(()=>users.id,{onDelete:'cascade'}),expires:integer('expires').notNull()});
export const authLimits = sqliteTable('crm_auth_limits',{key:text('key').primaryKey(),attempts:integer('attempts').notNull(),expires:integer('expires').notNull()});
