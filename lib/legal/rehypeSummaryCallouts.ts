import type { Element, ElementContent, Root, RootContent } from 'hast'

/** Bold label that opens every Taglish summary blockquote. */
export const SUMMARY_LABEL = 'Sa madaling salita'

/** Set on a blockquote whose label was stripped, so the renderer can show it as an eyebrow. */
export const SUMMARY_CALLOUT_PROPERTY = 'dataSummaryCallout'

const LABEL_PATTERN = new RegExp(`^${SUMMARY_LABEL}:?$`)
const LEADING_SEPARATOR_PATTERN = /^[\s:]+/

function isElement(node: RootContent | ElementContent | undefined, tagName: string): node is Element {
  return node?.type === 'element' && node.tagName === tagName
}

function textOf(node: ElementContent): string {
  if (node.type === 'text') return node.value
  if (node.type === 'element') return node.children.map(textOf).join('')
  return ''
}

function stripLabel(blockquote: Element): boolean {
  const paragraph = blockquote.children.find((child) => child.type === 'element')
  if (!isElement(paragraph, 'p')) return false

  const [first, next] = paragraph.children
  if (!isElement(first, 'strong') || !LABEL_PATTERN.test(textOf(first).trim())) return false

  paragraph.children.shift()
  // The colon sits outside the bold in some files: "**Sa madaling salita**: text"
  if (next?.type === 'text') next.value = next.value.replace(LEADING_SEPARATOR_PATTERN, '')
  return true
}

function visit(nodes: (RootContent | ElementContent)[]) {
  for (const node of nodes) {
    if (node.type !== 'element') continue
    if (node.tagName === 'blockquote' && stripLabel(node)) node.properties[SUMMARY_CALLOUT_PROPERTY] = true
    visit(node.children)
  }
}

/**
 * Remove the leading "**Sa madaling salita:**" from summary blockquotes and
 * mark them, so the label renders once as an eyebrow instead of bold text.
 * Blockquotes without the label are left untouched.
 */
export function rehypeSummaryCallouts() {
  return (tree: Root) => visit(tree.children)
}
