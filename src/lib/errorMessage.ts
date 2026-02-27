/** Common Supabase / auth error messages → Chinese translations */
const errorMap: Record<string, string> = {
    'email rate limit exceeded': '邮件发送频率超限，请稍后再试（建议等待几分钟）',
    'rate limit exceeded': '操作频率超限，请稍后再试',
    'user already registered': '该邮箱已注册',
    'invalid login credentials': '邮箱或密码错误',
    'email not confirmed': '邮箱尚未验证，请查收验证邮件',
    'new password should be different from the old password': '新密码不能与旧密码相同',
    'unable to validate email address: invalid format': '邮箱格式不正确',
    'signup is disabled': '注册暂不可用',
    'password should be at least 6 characters': '密码至少6位',
}

export function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message.trim()) {
        const msg = error.message.trim().toLowerCase()
        for (const [key, value] of Object.entries(errorMap)) {
            if (msg.includes(key)) return value
        }
        return error.message
    }

    return fallback
}
