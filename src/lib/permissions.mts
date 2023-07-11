
// WARNING: Change this can make permissions feature not working!
// first 20 bit can be for making separate permission like kick, add, etc.
// the further to the left the higher
export enum PermissionsFlags {
    Banned = 0,
    Member = 1, // 0001 = 1
    Register = (1 << 1) | PermissionsFlags.Member, // 0011 = 3
    Admin = (1 << 2) | PermissionsFlags.Member, // 0101 = 5
    BotAdmin = (1 << 3) | PermissionsFlags.Admin, // 1101 = 13
    // they also have the permission of the lower ranks
    Premium = (1 << 20) | PermissionsFlags.Member,
    Moderator = (1 << 28) | PermissionsFlags.Premium,
    Host = (1 << 29) | PermissionsFlags.Register | PermissionsFlags.Moderator,
    Owner = (1 << 30) | PermissionsFlags.Register | PermissionsFlags.Host
}



export default class PermissionManager {
    private isBotAdmin = false
    private isAdmin = false
    private isOwner = false
    private isBanned = false
    private isRegistered = false
    permissions = PermissionsFlags.Member
    constructor(opts: PermissionManagerOptions) {
        this.permissions = opts.permission
        this.isBanned = opts.banned
        this.isAdmin = opts.isAdmin
        this.isBotAdmin = opts.isBotAdmin
        this.isOwner = opts.isOwner
        this.isRegistered = opts.registered

        // Append data from options to a permissions
        this.permissions |= this.isRegistered ? PermissionsFlags.Register : 0
        this.permissions |= this.isOwner ? PermissionsFlags.Owner : 0
        this.permissions |= this.isBotAdmin ? PermissionsFlags.BotAdmin : 0
        this.permissions |= this.isAdmin ? PermissionsFlags.Admin : 0
        // if user is banned reset permission to zero, which mean user have no any permission
        // if permission is zero, check function will not return true 
        if (this.isBanned) this.permissions &= PermissionsFlags.Banned
    }

    /**
     * If permission was valid return true, otherwise return array of invalid permission
     */
    check (expectedPermissions: PermissionsFlags[] | PermissionsFlags) {
        if (!Array.isArray(expectedPermissions)) expectedPermissions = [expectedPermissions]
        const invalidPermissions = expectedPermissions.map((permission) => {
            // if user permission is 0011 and expected permission is 0001 it will be given 0001
            // but if user permission is 0011 and expected permission is 0111 it will be given 0011
            // that means if after the AND operation, the result is equal to the expected permissions -- pass
            if ((this.permissions & permission) === permission) return
            return permission
        }).filter(Boolean) as PermissionsFlags[]
        // if they don't have invalid permissions
        if (!invalidPermissions.length) return true
        // otherwise return array of invalid permission
        return invalidPermissions
    }
}

export interface PermissionManagerOptions {
    /** Base permission */
    permission: number
    isBotAdmin: boolean
    isAdmin: boolean
    isOwner: boolean
    banned: boolean
    registered: boolean
}