export interface Box { x: number; y: number; width: number; height: number }
export type Side = 'top' | 'right' | 'bottom' | 'left'

function center(n: Box) { return { x: n.x + n.width / 2, y: n.y + n.height / 2 } }

function intersection(node: Box, other: Box): { x: number; y: number } {
  const wHalf = node.width / 2, hHalf = node.height / 2
  const c = center(node), o = center(other)
  const x2 = c.x, y2 = c.y
  const xx1 = (o.x - x2) / (2 * wHalf) - (o.y - y2) / (2 * hHalf)
  const yy1 = (o.x - x2) / (2 * wHalf) + (o.y - y2) / (2 * hHalf)
  const a = 1 / (Math.abs(xx1) + Math.abs(yy1) || 1)
  const xx3 = a * xx1, yy3 = a * yy1
  return { x: wHalf * (xx3 + yy3) + x2, y: hHalf * (-xx3 + yy3) + y2 }
}

function sideOf(node: Box, p: { x: number; y: number }): Side {
  const nx = Math.round(node.x), ny = Math.round(node.y)
  const px = Math.round(p.x), py = Math.round(p.y)
  if (px <= nx + 1) return 'left'
  if (px >= nx + node.width - 1) return 'right'
  if (py <= ny + 1) return 'top'
  return 'bottom'
}

export function floatingEdgeParams(source: Box, target: Box): {
  sx: number; sy: number; tx: number; ty: number; sourcePos: Side; targetPos: Side
} {
  const sc = center(source)
  const tc = center(target)
  const dx = tc.x - sc.x
  const dy = tc.y - sc.y

  if (source.width <= 0 || source.height <= 0 || target.width <= 0 || target.height <= 0
    || (dx === 0 && dy === 0)) {
    let sourcePos: Side, targetPos: Side
    if (dx === 0 && dy === 0) {
      sourcePos = 'bottom'; targetPos = 'top'
    } else if (Math.abs(dx) >= Math.abs(dy)) {
      sourcePos = dx > 0 ? 'right' : 'left'
      targetPos = dx > 0 ? 'left' : 'right'
    } else {
      sourcePos = dy > 0 ? 'bottom' : 'top'
      targetPos = dy > 0 ? 'top' : 'bottom'
    }
    return { sx: sc.x, sy: sc.y, tx: tc.x, ty: tc.y, sourcePos, targetPos }
  }

  const sp = intersection(source, target)
  const tp = intersection(target, source)
  return { sx: sp.x, sy: sp.y, tx: tp.x, ty: tp.y, sourcePos: sideOf(source, sp), targetPos: sideOf(target, tp) }
}
