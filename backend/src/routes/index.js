/** 路由汇总 */
import { Router } from 'express'
import authRouter from './auth.js'
import filesRouter from './files.js'
import membersRouter from './members.js'
import messagesRouter from './messages.js'
import newsRouter from './news.js'
import projectsRouter from './projects.js'
import siteRouter from './site.js'

const router = Router()

router.get('/health', (req, res) => {
  res.json({ success: true, message: 'ok', data: { status: 'healthy', time: new Date().toISOString() } })
})

router.use('/auth', authRouter)
router.use('/site', siteRouter)
router.use('/files', filesRouter)
router.use('/projects', projectsRouter)
router.use('/news', newsRouter)
router.use('/members', membersRouter)
router.use('/messages', messagesRouter)

export default router
