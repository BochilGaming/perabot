
// WARNING: Change this can make permissions feature not working!
// first 10 bit can be for making separate permission like kick, add, etc.
export enum PermissionsFlags {
    Banned = 0,
    Member = 1 << 10,
    Admin = (1 << 1) | PermissionsFlags.Member,
    // only 1 higher from PermissionsFlags.Admin :v
    BotAdmin = 0b11 | PermissionsFlags.Member,
    // they also have the permission of the lower ranks
    Premium = (1 << 10 << 1) | PermissionsFlags.Member,
    Moderator = (1 << 10 << 4) | PermissionsFlags.Premium,
    Host = (1 << 10 << 5) | PermissionsFlags.Moderator,
    Owner = (1 << 10 << 6) | PermissionsFlags.Host
}



export default class PermissionManager {
    #isBotAdmin = false
    #isAdmin = false
    #isOwner = false
    #isBanned = false
    constructor(public permission: number, opts: PermissionManagerOptions) {
        this.#isBanned = opts.banned
        this.#isAdmin = opts.isAdmin
        this.#isBotAdmin = opts.isBotAdmin
        this.#isOwner = opts.isOwner

        // Append data from options to a permission
        this.permission |= this.#isOwner ? PermissionsFlags.Owner : 0
        this.permission |= this.#isBotAdmin ? PermissionsFlags.BotAdmin : 0
        this.permission |= this.#isAdmin ? PermissionsFlags.Admin : 0
        // if user is banned reset permission to zero, which mean user have no any permission
        // if permission is zero, check function will not return true 
        if (this.#isBanned) this.permission &= PermissionsFlags.Banned
    }

    /**
     * If permission was valid return true, otherwise return array of invalid permission
     */
    check (expectedPermissions: PermissionsFlags[] | PermissionsFlags) {
        if (!Array.isArray(expectedPermissions)) expectedPermissions = [expectedPermissions]
        const invalidPermissions = expectedPermissions.map((permission) => {
            // if user permission is 0001 and expected permission is 0001 it will be given 0001
            // but if user permission is 0001 and expected permission is 0010 it will be given 0000
            // that means if zero it doesn't have that permission
            if ((permission & this.permission) !== 0) return
            return permission
        }).filter(Boolean) as PermissionsFlags[]
        // if don't have invalid permissions, it means they have all permissions and return true
        if (!invalidPermissions.length) return true
        // otherwise return array of invalid permission
        return invalidPermissions
    }
}

export interface PermissionManagerOptions {
    isBotAdmin: boolean
    isAdmin: boolean
    isOwner: boolean
    banned: boolean
}