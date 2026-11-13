import DOMPurify from 'dompurify'
import { JSDOM } from 'jsdom'
import postcss, { type AtRule, type Root, type Rule } from 'postcss'

/**
 * Designed sections hold HTML and CSS written by connected Claude (or an editor).
 * Everything that could run code, phish, or reach outside the section is removed here,
 * both when it is saved and again when it is shown.
 */

let purifier: ReturnType<typeof DOMPurify> | null = null
const getPurifier = () => {
  if (!purifier) {
    const { window } = new JSDOM('')
    purifier = DOMPurify(window as unknown as Window & typeof globalThis)
    purifier.addHook('afterSanitizeAttributes', (node) => {
      if (node.getAttribute?.('target') === '_blank') {
        node.setAttribute('rel', 'noopener noreferrer')
      }
    })
  }
  return purifier
}

export function cleanDesignHtml(html: string | null | undefined): string {
  if (!html) return ''
  return getPurifier().sanitize(html, {
    USE_PROFILES: { html: true, svg: true, svgFilters: true },
    ADD_ATTR: ['target', 'loading', 'decoding'],
    FORBID_TAGS: [
      'script', 'style', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet',
      'base', 'meta', 'link', 'form', 'input', 'textarea', 'select', 'option', 'noscript',
    ],
    FORBID_ATTR: ['formaction', 'srcdoc'],
    ALLOW_DATA_ATTR: true,
  }) as string
}

const FONT_IMPORT = /^(url\()?\s*["']?https:\/\/fonts\.googleapis\.com\/css2?\?[^"')\s]+["']?\s*\)?/i
const BAD_VALUE = /expression\s*\(|javascript:|vbscript:|-moz-binding|behavior\s*:/i

/** Scope every rule to the section, keep only Google Fonts imports, drop anything risky. */
export function scopeDesignCss(css: string | null | undefined, scope: string): string {
  if (!css) return ''
  let root: Root
  try {
    root = postcss.parse(css)
  } catch {
    return ''
  }
  const imports: string[] = []

  root.walkAtRules((at: AtRule) => {
    const name = at.name.toLowerCase()
    if (name === 'import') {
      if (FONT_IMPORT.test(at.params.trim())) imports.push(`@import ${at.params};`)
      at.remove()
    } else if (name === 'charset' || name === 'namespace' || name === 'page') {
      at.remove()
    }
  })

  root.walkDecls((decl) => {
    if (BAD_VALUE.test(decl.value) || BAD_VALUE.test(decl.prop)) decl.remove()
  })

  root.walkRules((rule: Rule) => {
    // Keyframe steps (from, to, 50%) are not selectors.
    let parent = rule.parent
    while (parent && parent.type !== 'root') {
      if (parent.type === 'atrule' && /keyframes$/i.test((parent as AtRule).name)) return
      parent = parent.parent
    }
    rule.selectors = rule.selectors.map((sel) => {
      const s = sel.trim()
      if (!s) return s
      const replaced = s.replace(/^(:root|html|body)(?=$|[\s.#:[>+~])/i, scope)
      if (replaced !== s) return replaced
      if (s.startsWith(scope)) return s
      return `${scope} ${s}`
    })
  })

  const out = imports.join('\n') + '\n' + root.toString()
  // "<" never belongs in CSS outside strings; escaping every one means the styles can't
  // close their own <style> tag, however the text is arranged.
  return out.replace(/</g, '\\3c ')
}
