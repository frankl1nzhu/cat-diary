export function lightHaptic() {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([50])
    }
}

export function mediumHaptic() {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([80])
    }
}
