import { describe, expect, it } from 'vitest'
import { roundQuantity, type FeedStatus } from '../types/database.types'

describe('inventoryFeedStats', () => {
    function computeInventoryFeedData(
        feeds: FeedStatus[],
        mode: 'grams' | 'count',
        startTs: number,
        endTs: number,
    ) {
        const dataMap = new Map<string, number>()
        feeds.forEach((f) => {
            const at = f.fed_at || f.updated_at
            const t = new Date(at).getTime()
            if (t >= startTs && t <= endTs) {
                const parts = f.meal_type.split('|')
                const itemName = parts[0]
                if (itemName) {
                    if (mode === 'grams') {
                        const grams = parts[1] ? parseFloat(parts[1]) : 0
                        if (!isNaN(grams)) {
                            dataMap.set(itemName, roundQuantity((dataMap.get(itemName) || 0) + grams, 1))
                        }
                    } else {
                        dataMap.set(itemName, (dataMap.get(itemName) || 0) + 1)
                    }
                }
            }
        })

        return Array.from(dataMap.entries())
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
    }

    const testFeeds: FeedStatus[] = [
        {
            id: '1',
            cat_id: 'c1',
            status: 'fed',
            fed_by: 'u1',
            fed_at: '2026-10-12T10:00:00Z',
            meal_type: '渴望猫粮|30',
            updated_at: '2026-10-12T10:00:00Z',
        },
        {
            id: '2',
            cat_id: 'c1',
            status: 'fed',
            fed_by: 'u1',
            fed_at: '2026-10-12T12:00:00Z',
            meal_type: '渴望猫粮|20.5',
            updated_at: '2026-10-12T12:00:00Z',
        },
        {
            id: '3',
            cat_id: 'c1',
            status: 'fed',
            fed_by: 'u1',
            fed_at: '2026-10-12T18:00:00Z',
            meal_type: '主食罐|85',
            updated_at: '2026-10-12T18:00:00Z',
        },
    ]

    const startTs = new Date('2026-10-12T00:00:00Z').getTime()
    const endTs = new Date('2026-10-12T23:59:59Z').getTime()

    it('aggregates total grams consumed correctly without float precision artifacts', () => {
        const result = computeInventoryFeedData(testFeeds, 'grams', startTs, endTs)
        expect(result).toEqual([
            { name: '主食罐', value: 85 },
            { name: '渴望猫粮', value: 50.5 },
        ])
    })

    it('aggregates total feed count in count mode', () => {
        const result = computeInventoryFeedData(testFeeds, 'count', startTs, endTs)
        expect(result).toEqual([
            { name: '渴望猫粮', value: 2 },
            { name: '主食罐', value: 1 },
        ])
    })
})
