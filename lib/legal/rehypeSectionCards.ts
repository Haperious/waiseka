import type { Element, ElementContent, Root, RootContent } from 'hast'

export interface RehypeSectionCardsOptions {
  /** Class for each `<section>`, normally a CSS module class. */
  className: string
}

function isH3(node: RootContent): node is Element {
  return node.type === 'element' && node.tagName === 'h3'
}

/**
 * Wrap each top-level H3 and everything after it, up to the next H3, in
 * `<section class aria-labelledby={h3 id}>`. Content before the first H3
 * stays outside. Run after rehype-slug so the headings already have ids.
 */
export function rehypeSectionCards({ className }: RehypeSectionCardsOptions) {
  return (tree: Root) => {
    const children: RootContent[] = []
    let current: Element | null = null

    for (const node of tree.children) {
      if (isH3(node)) {
        const id = node.properties.id
        const section: Element = {
          type: 'element',
          tagName: 'section',
          // aria-labelledby is an id list, so hast types it as an array
          properties: { className: [className], ...(typeof id === 'string' && { ariaLabelledBy: [id] }) },
          children: [node],
        }
        children.push(section)
        current = section
      } else if (current && node.type !== 'doctype') {
        current.children.push(node as ElementContent)
      } else {
        children.push(node)
      }
    }

    tree.children = children
  }
}
