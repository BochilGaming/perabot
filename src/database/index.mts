import { ChatsDatabase } from './chats.mjs'
import { UsersDatabase } from './users.mjs'
import path from 'path'

export * from './database.mjs'
export * from './chats.mjs'
export * from './users.mjs'


const baseFolder = './database'
const usersFolder = path.join(baseFolder, './users')
const chatsFolder = path.join(baseFolder, './chats')

export const users = new UsersDatabase(usersFolder)
export const chats = new ChatsDatabase(chatsFolder)