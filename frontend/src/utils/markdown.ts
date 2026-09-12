/** 轻量 markdown 渲染（无第三方依赖，先转义再解析，避免 XSS） */

const escapeHtml = (input: string) =>
  input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const inline = (text: string) =>
  text
    // 行内代码
    .replace(/`([^`]+)`/g, (_m, code) => `<code>${code}</code>`)
    // 粗体 / 斜体 / 删除线
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>')
    // 链接 [文字](地址)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label, href) => {
      const safe = /^(https?:|\/|mailto:|#)/i.test(href) ? href : '#'
      return `<a href="${safe}" target="_blank" rel="noopener noreferrer">${label}</a>`
    })

export const renderMarkdown = (source = ''): string => {
  if (!source) return ''
  const lines = escapeHtml(String(source)).replace(/\r\n/g, '\n').split('\n')
  const html: string[] = []
  let inCode = false
  let listType: 'ul' | 'ol' | null = null
  let paragraph: string[] = []
  let tableBuffer: string[] = []

  const flushParagraph = () => {
    if (paragraph.length) {
      html.push(`<p>${inline(paragraph.join('<br />'))}</p>`)
      paragraph = []
    }
  }
  const closeList = () => {
    if (listType) {
      html.push(`</${listType}>`)
      listType = null
    }
  }
  const flushTable = () => {
    if (!tableBuffer.length) return
    const rows = tableBuffer
      .filter((row) => !/^\s*\|?[\s:|-]+\|?\s*$/.test(row))
      .map((row) =>
        row
          .replace(/^\s*\|/, '')
          .replace(/\|\s*$/, '')
          .split('|')
          .map((cell) => cell.trim())
      )
    if (rows.length) {
      const [head, ...body] = rows
      html.push('<table><thead><tr>')
      head.forEach((cell) => html.push(`<th>${inline(cell)}</th>`))
      html.push('</tr></thead><tbody>')
      body.forEach((row) => {
        html.push('<tr>')
        row.forEach((cell) => html.push(`<td>${inline(cell)}</td>`))
        html.push('</tr>')
      })
      html.push('</tbody></table>')
    }
    tableBuffer = []
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd()

    // 代码块
    if (/^```/.test(line.trim())) {
      flushParagraph()
      closeList()
      flushTable()
      html.push(inCode ? '</code></pre>' : '<pre><code>')
      inCode = !inCode
      continue
    }
    if (inCode) {
      html.push(`${line}\n`)
      continue
    }

    // 表格
    if (/^\s*\|.*\|\s*$/.test(line)) {
      flushParagraph()
      closeList()
      tableBuffer.push(line)
      continue
    }
    flushTable()

    // 空行
    if (!line.trim()) {
      flushParagraph()
      closeList()
      continue
    }

    // 标题
    const heading = line.match(/^(#{1,6})\s+(.*)$/)
    if (heading) {
      flushParagraph()
      closeList()
      const level = Math.min(6, heading[1].length + 1) // # 视作 h2，页面已有 h1
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`)
      continue
    }

    // 分割线
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      flushParagraph()
      closeList()
      html.push('<hr />')
      continue
    }

    // 引用
    const quote = line.match(/^>\s?(.*)$/)
    if (quote) {
      flushParagraph()
      closeList()
      html.push(`<blockquote>${inline(quote[1])}</blockquote>`)
      continue
    }

    // 有序 / 无序列表
    const ordered = line.match(/^\s*\d+[.)]\s+(.*)$/)
    const unordered = line.match(/^\s*[-*+]\s+(.*)$/)
    if (ordered || unordered) {
      flushParagraph()
      const want: 'ul' | 'ol' = ordered ? 'ol' : 'ul'
      if (listType !== want) {
        closeList()
        html.push(`<${want}>`)
        listType = want
      }
      html.push(`<li>${inline((ordered || unordered)![1])}</li>`)
      continue
    }

    closeList()
    paragraph.push(line)
  }

  flushParagraph()
  closeList()
  flushTable()
  if (inCode) html.push('</code></pre>')

  return html.join('\n')
}
