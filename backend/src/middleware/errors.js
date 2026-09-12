/** 统一错误类型与错误处理中间件 */
export class ApiError extends Error {
  constructor(status, message, details = null) {
    super(message)
    this.status = status
    this.details = details
  }
  static badRequest(msg = '请求参数有误', details) {
    return new ApiError(400, msg, details)
  }
  static unauthorized(msg = '未登录或登录已过期') {
    return new ApiError(401, msg)
  }
  static forbidden(msg = '没有权限执行该操作') {
    return new ApiError(403, msg)
  }
  static notFound(msg = '资源不存在') {
    return new ApiError(404, msg)
  }
  static tooLarge(msg = '文件超出大小限制') {
    return new ApiError(413, msg)
  }
  static conflict(msg = '资源已存在') {
    return new ApiError(409, msg)
  }
  static internal(msg = '服务器内部错误') {
    return new ApiError(500, msg)
  }
}

/** 包装 async 路由，异常自动交给 errorHandler */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next)
}

export const notFoundHandler = (req, res, next) => {
  next(new ApiError(404, `接口不存在: ${req.method} ${req.originalUrl}`))
}

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  let status = err.status || err.statusCode || 500
  let message = err.message || '服务器内部错误'
  let details = err.details || null

  // multer 错误转换
  if (err.code === 'LIMIT_FILE_SIZE') {
    status = 413
    message = '文件超出大小限制'
  } else if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
    status = 400
    message = '文件数量或字段不符合要求'
  } else if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    status = 409
    message = '记录已存在（唯一字段重复）'
  }

  if (status >= 500) {
    console.error('[error]', req.method, req.originalUrl, err)
  }

  res.status(status).json({
    success: false,
    message,
    details,
    ...(process.env.NODE_ENV === 'production' ? {} : { stack: err.stack })
  })
}

/** 统一成功响应 */
export const ok = (res, data = null, message = 'ok', extra = {}) =>
  res.json({ success: true, message, data, ...extra })
