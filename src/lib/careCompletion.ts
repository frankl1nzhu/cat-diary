export function computeIsTodayCareComplete(feedsCount: number, mood: string | null, poopCount: number): boolean {
    return feedsCount > 0 && (mood !== null || poopCount > 0)
}
