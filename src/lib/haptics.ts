export function lightHaptic() {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([50])
    }
}
