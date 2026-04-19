/** Common Supabase / auth error messages → Chinese translations */
const errorMap: Record<string, string> = {
    // Auth errors
    'email rate limit exceeded': '邮件发送频率超限，请稍后再试（建议等待几分钟）',
    'rate limit exceeded': '操作频率超限，请稍后再试',
    'user already registered': '该邮箱已注册',
    'invalid login credentials': '邮箱或密码错误',
    'email not confirmed': '邮箱尚未验证，请查收验证邮件',
    'new password should be different from the old password': '新密码不能与旧密码相同',
    'unable to validate email address: invalid format': '邮箱格式不正确',
    'signup is disabled': '注册暂不可用',
    'password should be at least 6 characters': '密码至少6位',
    'user not found': '用户不存在',
    'token has expired or is invalid': '链接已过期，请重新发起操作',
    'session_not_found': '登录已过期，请重新登录',
    'auth session missing': '登录已过期，请重新登录',
    'refresh_token_not_found': '登录凭证已失效，请重新登录',
    // Network / Supabase errors
    'failed to fetch': '网络连接失败，请检查网络后重试',
    'network request failed': '网络请求失败，请检查网络后重试',
    'networkerror': '网络错误，请检查连接',
    'load failed': '加载失败，请检查网络后重试',
    'the operation was aborted': '操作超时，请稍后重试',
    'timeout': '请求超时，请稍后重试',
    'aborted': '请求被中断，请重试',
    // RLS / permission errors
    'new row violates row-level security policy': '权限不足，无法执行此操作',
    'permission denied': '权限不足',
    'insufficient_privilege': '权限不足，请联系管理员',
    'not_found': '请求的资源不存在',
    // Storage errors
    'the resource already exists': '文件已存在',
    'payload too large': '文件太大，请压缩后重试',
    'bucket not found': '存储空间不存在',
    // General DB errors
    'duplicate key value violates unique constraint': '数据已存在，请勿重复提交',
    'violates foreign key constraint': '关联数据不存在，请刷新后重试',
    'could not find the': '数据不存在或已被删除',
    'invalid input value for enum': '数据格式不正确，请刷新后重试',
    'null value in column': '数据写入失败，请刷新后重试',
}

export function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message.trim()) {
        const msg = error.message.trim().toLowerCase()
        for (const [key, value] of Object.entries(errorMap)) {
            if (msg.includes(key)) return value
        }
        return error.message
    }

    // Handle Supabase error objects with message property
    if (error && typeof error === 'object' && 'message' in error) {
        const rawMsg = String((error as { message: unknown }).message).trim()
        const msg = rawMsg.toLowerCase()
        for (const [key, value] of Object.entries(errorMap)) {
            if (msg.includes(key)) return value
        }
        if (rawMsg) return rawMsg
    }

    return fallback
}
