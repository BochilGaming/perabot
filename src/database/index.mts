import { ChatsDatabase } from './chats.mjs'
import { UsersDatabase } from './users.mjs'

export * from './database.mjs'
export * from './chats.mjs'
export * from './users.mjs'

export const users = new UsersDatabase()
export const chats = new ChatsDatabase()