/** multer 上传中间件：磁盘存储 + 白名单校验 + 大小限制 */
import multer from 'multer'
import { config, ensureRuntimeDirs } from '../config.js'
import { generateStoredName, isAllowedFile, sanitizeOriginalName } from '../services/storage.js'

ensureRuntimeDirs()

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, config.uploadDir),
  filename: (req, file, cb) => {
    // 原始名可能含中文，multer 默认按 latin1 解码，这里还原为 utf8
    try {
      file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8')
    } catch {
      /* 保持原样 */
    }
    file.originalname = sanitizeOriginalName(file.originalname)
    cb(null, generateStoredName(file.originalname))
  }
})

const fileFilter = (req, file, cb) => {
  const check = isAllowedFile(file.originalname)
  if (!check.ok) {
    const err = new Error(check.reason)
    err.status = 400
    return cb(err)
  }
  cb(null, true)
}

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.maxUploadSize,
    files: 20,
    fields: 30
  }
})

/** 单文件字段：file */
export const uploadSingle = upload.single('file')
/** 多文件字段：files（最多 20 个） */
export const uploadMultiple = upload.array('files', 20)
/** 兼容前端的混合字段 */
export const uploadAny = upload.any()
