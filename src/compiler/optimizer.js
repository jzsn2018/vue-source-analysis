/* @flow */

import { makeMap, isBuiltInTag, cached, no } from 'shared/util'

let isStaticKey
let isPlatformReservedTag

const genStaticKeysCached = cached(genStaticKeys)

/**
 * Goal of the optimizer: walk the generated template AST tree
 * and detect sub-trees that are purely static, i.e. parts of
 * the DOM that never needs to change.
 *
 * Once we detect these sub-trees, we can:
 *
 * 1. Hoist them into constants, so that we no longer need to
 *    create fresh nodes for them on each re-render;
 * 2. Completely skip them in the patching process.
 */

//* 优化程序的目标：遍历生成的模板AST树
//* 并检测纯静态的子树，即
//* 永远不需要更改的DOM。
//* 
//* 一旦我们检测到这些子树，我们可以：
//* 
//* 1.将它们提升为常数，这样我们就不再需要
//* 在每次重新渲染时为它们创建新的节点；
//* 2.在修补过程中完全跳过它们。

export function optimize (root: ?ASTElement, options: CompilerOptions) {
  if (!root) return
  isStaticKey = genStaticKeysCached(options.staticKeys || '')
  isPlatformReservedTag = options.isReservedTag || no
  // first pass: mark all non-static nodes.
  //* 1. 标记静态节点
  markStatic(root)
  // second pass: mark static roots.
  //* 2. 标记静态根节点
  markStaticRoots(root, false)
}

function genStaticKeys (keys: string): Function {
  return makeMap(
    'type,tag,attrsList,attrsMap,plain,parent,children,attrs,start,end,rawAttrsMap,has$Slot' +
    (keys ? ',' + keys : '')
  )
}

function markStatic (node: ASTNode) {
  node.static = isStatic(node)
  if (node.type === 1) {
    // do not make component slot content static. this avoids
    // 1. components not able to mutate slot nodes
    // 2. static slot content fails for hot-reloading
    if (
      !isPlatformReservedTag(node.tag) &&
      !node.component &&
      node.tag !== 'slot' &&
      node.attrsMap['inline-template'] == null
    ) {
      return
    }
    for (let i = 0, l = node.children.length; i < l; i++) {
      const child = node.children[i]
      markStatic(child)
      if (!child.static) {
        node.static = false
      }
    }
    if (node.ifConditions) {
      for (let i = 1, l = node.ifConditions.length; i < l; i++) {
        const block = node.ifConditions[i].block
        markStatic(block)
        if (!block.static) {
          node.static = false
        }
      }
    }
  }
}

function markStaticRoots (node: ASTNode, isInFor: boolean) {
  if (node.type === 1) { //* node.type==1 表示当前节点是  元素  类型
    if (node.static || node.once) {
      node.staticInFor = isInFor
    }
    // For a node to qualify as a static root, it should have children that
    // are not just static text. Otherwise the cost of hoisting out will
    // outweigh the benefits and it's better off to just always render it fresh.
    //* 如果一个元素内只有文本节点，此时这个元素不是静态的root
    //* Vue会认为这种优化会带来负面的影响
    if (node.static && node.children.length && !(
      node.children.length === 1 &&
      node.children[0].type === 3
    )) {
      node.staticRoot = true
      return
    } else {
      node.staticRoot = false
    }
    //* 检测当前节点的子节点是否有静态的 root
    if (node.children) {
      for (let i = 0, l = node.children.length; i < l; i++) {
        markStaticRoots(node.children[i], isInFor || !!node.for)
      }
    }
    if (node.ifConditions) {
      for (let i = 1, l = node.ifConditions.length; i < l; i++) {
        markStaticRoots(node.ifConditions[i].block, isInFor)
      }
    }
  }
}

function isStatic (node: ASTNode): boolean {
  if (node.type === 2) { //* 表达式 expression
    return false
  }
  if (node.type === 3) { //* 文本 text
    return true
  }
  return !!(
    //* pre标签
    node.pre || (
    !node.hasBindings && //* 不是v-bind动态绑定 no dynamic bindings
    !node.if && !node.for && //* not v-if or v-for or v-else
    !isBuiltInTag(node.tag) && //* not a built-in 不是内置标签( slot,component )
    isPlatformReservedTag(node.tag) && //* not a component 不是组件
    !isDirectChildOfTemplateFor(node) && //* 不是 v-for 下面的children子节点
    Object.keys(node).every(isStaticKey)
  ))
}
//* 带有v-for指令的 template标签
function isDirectChildOfTemplateFor (node: ASTElement): boolean {
  while (node.parent) {
    node = node.parent
    if (node.tag !== 'template') {
      return false
    }
    if (node.for) {
      return true
    }
  }
  return false
}
