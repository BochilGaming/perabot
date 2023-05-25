// from https://github.com/Nurutomo/wabot-aq/blob/master/lib/levelling.js
import assert from 'assert'

export default class Levelling {
    /**
     * Growth rate
     * 2.4048752025159685
     */
    static readonly growth = Math.pow(Math.PI / Math.E, 1.618) * Math.E * .70
    protected static multiplier = 0

    static setMultiplier (multiplier: number) {
        assert.ok(typeof multiplier === 'number' && !isNaN(multiplier) && isFinite(multiplier) && multiplier >= 0, `'multiplier' must be a number of and can't be NaN or Infinity and cannot be negative either`)
        Levelling.multiplier = multiplier
    }
    
    static xpRange (level: number) {
        if (level < 0) throw new TypeError('level cannot be negative value')
        level = Math.floor(level)
        // minimum xp to get that level
        const min = level === 0 ? 0 : Math.round(Math.pow(level, this.growth) * Levelling.multiplier) + 1
        // max xp in that level before to next level
        const max = Math.round(Math.pow(++level, this.growth) * Levelling.multiplier)
        return {
            min,
            max,
            xp: max - min
        }
    }

    /**
     * Get level by xp
     */
    static findLevel (xp: number) {
        if (xp === Infinity) return Infinity
        if (isNaN(xp)) return NaN
        if (xp <= 0) return -1
        let level = 0
        do level++
        while (Levelling.xpRange(level).min <= xp)
        return --level
    }

    static canLevelUp(level: number, xp: number) {
        if (level < 0) return false
        if (xp === Infinity) return true
        if (isNaN(xp)) return false
        if (xp <= 0) return false
        return Levelling.xpRange(level).max <= xp 
    }
}