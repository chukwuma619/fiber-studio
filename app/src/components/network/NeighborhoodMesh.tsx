import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { select } from "d3-selection"
import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force"
import { zoom, zoomIdentity, type ZoomBehavior } from "d3-zoom"
import { normalizePubkey, pubkeysEqual } from "../../lib/fnn/relay"
import type {
  NeighborhoodExpandedNode,
  NeighborhoodPeer,
  NeighborhoodPublicLink,
} from "../../lib/fnn/types"
import { Text } from "../ui/text"

const MIN_ZOOM = 0.2
const MAX_ZOOM = 8
const BUTTON_ZOOM = 1.25

type MeshKind = "self" | "peer" | "public" | "expanded"
type MeshEdgeTone = "own" | "private" | "gossip"

type GraphNode = SimulationNodeDatum & {
  id: string
  pubkey: string | null
  label: string
  name: string | null
  kind: MeshKind
  privateOnly: boolean
  deg: number
  r: number
  x: number
  y: number
}

type GraphLink = SimulationLinkDatum<GraphNode> & {
  tone: MeshEdgeTone
  bend: number
  weight: number
}

type Graph = {
  nodes: GraphNode[]
  links: GraphLink[]
}

type Camera = { x: number; y: number; k: number }

type Palette = {
  bg: string
  fg: string
  accent: string
  pale: string
  mut: string
  own: string
  glow: string
}

type NeighborhoodMeshProps = {
  selfLabel: string
  peers: NeighborhoodPeer[]
  expanded: NeighborhoodExpandedNode | null
  expandedPubkey: string | null
  isLoading: boolean
  graphReady: boolean
  onToggle: (pubkey: string) => void
}

function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))
}

function seedOf(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 16777619)
  }
  return (((hash >>> 0) % 10000) / 10000) * Math.PI * 2
}

function edgeId(left: string, right: string): string {
  return left < right ? `${left}|${right}` : `${right}|${left}`
}

function announcedName(label: string): string | null {
  const text = label.trim()
  if (!text || text === "You") return null
  if (text.includes("…") || text.includes("...")) return null
  if (/^(0x)?[0-9a-f]{6,}$/i.test(text)) return null
  return text
}

function nodeRadius(kind: MeshKind, degree: number): number {
  switch (kind) {
    case "self":
      return 14
    case "peer":
      return 5.4 + 1.7 * Math.sqrt(degree)
    case "public":
      return 4.4 + 0.55 * Math.sqrt(degree)
    case "expanded":
      return 3.8
    default: {
      const unreachable: never = kind
      return unreachable
    }
  }
}

function bendOf(key: string): number {
  return (((seedOf(key) * 1000) % 7) - 3) / 3 * 0.14
}

function endNode(end: GraphLink["source"]): GraphNode {
  return end as GraphNode
}

function settleGraph(
  selfLabel: string,
  peers: NeighborhoodPeer[],
  expanded: NeighborhoodExpandedNode | null,
  places: Map<string, { x: number; y: number }>,
): Graph {
  const nodes: GraphNode[] = []
  const byId = new Map<string, GraphNode>()

  const ensure = (
    id: string,
    pubkey: string | null,
    label: string,
    kind: MeshKind,
    privateOnly: boolean,
  ): GraphNode => {
    const existing = byId.get(id)
    if (existing) return existing
    const created: GraphNode = {
      id,
      pubkey,
      label,
      name: announcedName(label),
      kind,
      privateOnly,
      deg: 0,
      r: 4,
      x: 0,
      y: 0,
    }
    byId.set(id, created)
    nodes.push(created)
    return created
  }

  const self = ensure("self", null, selfLabel, "self", false)
  const links: GraphLink[] = []
  const seen = new Set<string>()
  const connect = (source: GraphNode, target: GraphNode, tone: MeshEdgeTone, weight: number) => {
    if (source.id === target.id) return
    const id = edgeId(source.id, target.id)
    if (seen.has(id)) return
    seen.add(id)
    links.push({ source, target, tone, weight, bend: bendOf(id) })
  }

  for (const peer of peers) {
    const node = ensure(
      normalizePubkey(peer.pubkey),
      peer.pubkey,
      peer.label,
      "peer",
      !peer.hasPublicChannel,
    )
    connect(self, node, node.privateOnly ? "private" : "own", Math.max(peer.channels.length, 1))
    if (node.privateOnly) continue
    for (const link of peer.publicLinks) {
      const other = ensure(normalizePubkey(link.pubkey), link.pubkey, link.label, "public", false)
      connect(node, other, "gossip", Math.max(link.channelCount, 1))
    }
  }

  if (expanded && expanded.publicLinks.length > 0) {
    const anchor = byId.get(normalizePubkey(expanded.pubkey))
    if (anchor) {
      for (const link of expanded.publicLinks) {
        const other = ensure(normalizePubkey(link.pubkey), link.pubkey, link.label, "expanded", false)
        connect(anchor, other, "gossip", Math.max(link.channelCount, 1))
      }
    }
  }

  const degree = new Map<string, number>()
  for (const link of links) {
    const source = endNode(link.source)
    const target = endNode(link.target)
    degree.set(source.id, (degree.get(source.id) ?? 0) + 1)
    degree.set(target.id, (degree.get(target.id) ?? 0) + 1)
  }
  for (const node of nodes) {
    node.deg = degree.get(node.id) ?? 0
    node.r = nodeRadius(node.kind, node.deg)
  }

  const placed = new Set<string>()
  let fresh = 0
  for (const node of nodes) {
    if (node.kind === "self") {
      node.x = 0
      node.y = 0
      node.fx = 0
      node.fy = 0
      placed.add(node.id)
      continue
    }
    const saved = places.get(node.id)
    if (!saved) {
      fresh += 1
      continue
    }
    node.x = saved.x
    node.y = saved.y
    node.fx = saved.x
    node.fy = saved.y
    placed.add(node.id)
  }

  const pending = nodes.filter((node) => !placed.has(node.id))
  let guard = pending.length * pending.length + 1
  while (pending.length > 0 && guard > 0) {
    guard -= 1
    const node = pending.shift()
    if (!node) break
    const anchor = neighborPlaced(node, links, placed)
    if (!anchor && pending.length > 0) {
      pending.push(node)
      continue
    }
    const seed = seedOf(node.id)
    node.x = (anchor?.x ?? 0) + Math.cos(seed) * 52
    node.y = (anchor?.y ?? 0) + Math.sin(seed) * 52
    placed.add(node.id)
  }

  const simulation = forceSimulation<GraphNode>(nodes)
    .force(
      "link",
      forceLink<GraphNode, GraphLink>(links)
        .distance((link) => {
          const source = endNode(link.source)
          const target = endNode(link.target)
          return 40 + 12 * Math.sqrt(Math.min(source.deg || 1, target.deg || 1))
        })
        .strength(0.55),
    )
    .force(
      "charge",
      forceManyBody<GraphNode>().strength((node) => {
        switch (node.kind) {
          case "self":
            return -280
          case "peer":
            return -160
          case "public":
            return -70
          case "expanded":
            return -48
          default: {
            const unreachable: never = node.kind
            return unreachable
          }
        }
      }),
    )
    .force(
      "collide",
      forceCollide<GraphNode>((node) => node.r + 8),
    )
    .force("x", forceX(0).strength(0.08))
    .force("y", forceY(0).strength(0.08))
    .stop()

  simulation.tick(fresh >= nodes.length - 1 ? 320 : 150)

  for (const node of nodes) {
    if (node.kind !== "self") {
      node.fx = null
      node.fy = null
    }
    places.set(node.id, { x: node.x, y: node.y })
  }

  return { nodes, links }
}

function neighborPlaced(node: GraphNode, links: GraphLink[], placed: Set<string>): GraphNode | null {
  for (const link of links) {
    const source = endNode(link.source)
    const target = endNode(link.target)
    if (source.id === node.id && placed.has(target.id)) return target
    if (target.id === node.id && placed.has(source.id)) return source
  }
  return null
}

function palette(dark: boolean): Palette {
  if (dark) {
    return {
      bg: "#09090b",
      fg: "#fafafa",
      accent: "#38bdf8",
      pale: "#d4d4d8",
      mut: "#71717a",
      own: "#e4e4e7",
      glow: "rgba(56, 189, 248, 0.34)",
    }
  }
  return {
    bg: "#fafafa",
    fg: "#09090b",
    accent: "#0284c7",
    pale: "#3f3f46",
    mut: "#a1a1aa",
    own: "#3f3f46",
    glow: "rgba(2, 132, 199, 0.22)",
  }
}

function edgeColor(tone: MeshEdgeTone, colors: Palette): string {
  switch (tone) {
    case "own":
      return colors.own
    case "private":
      return colors.mut
    case "gossip":
      return colors.accent
    default: {
      const unreachable: never = tone
      return unreachable
    }
  }
}

function edgeWidth(link: GraphLink): number {
  return 0.85 + 0.85 * Math.log2(1 + link.weight)
}

function drawCurve(
  ctx: CanvasRenderingContext2D,
  link: GraphLink,
  portion = 1,
) {
  const source = endNode(link.source)
  const target = endNode(link.target)
  const cx = (source.x + target.x) / 2 - (target.y - source.y) * link.bend
  const cy = (source.y + target.y) / 2 + (target.x - source.x) * link.bend
  ctx.beginPath()
  ctx.moveTo(source.x, source.y)
  if (portion >= 1) {
    ctx.quadraticCurveTo(cx, cy, target.x, target.y)
    return
  }
  for (let step = 1; step <= 16; step += 1) {
    const t = (step / 16) * portion
    const u = 1 - t
    ctx.lineTo(
      u * u * source.x + 2 * u * t * cx + t * t * target.x,
      u * u * source.y + 2 * u * t * cy + t * t * target.y,
    )
  }
}

function nodeFill(node: GraphNode, colors: Palette): string | null {
  switch (node.kind) {
    case "self":
      return colors.fg
    case "peer":
      return node.privateOnly ? null : colors.pale
    case "public":
    case "expanded":
      return colors.accent
    default: {
      const unreachable: never = node.kind
      return unreachable
    }
  }
}

function nodeStroke(node: GraphNode, colors: Palette, marked: boolean): string {
  if (marked) return colors.fg
  switch (node.kind) {
    case "self":
      return colors.fg
    case "peer":
      return node.privateOnly ? colors.mut : colors.own
    case "public":
    case "expanded":
      return colors.accent
    default: {
      const unreachable: never = node.kind
      return unreachable
    }
  }
}

function drawGraph(
  ctx: CanvasRenderingContext2D,
  graph: Graph,
  camera: Camera,
  selectedId: string | null,
  hoverId: string | null,
  width: number,
  height: number,
  dpr: number,
  colors: Palette,
) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = colors.bg
  ctx.fillRect(0, 0, width, height)
  ctx.translate(camera.x, camera.y)
  ctx.scale(camera.k, camera.k)
  ctx.lineCap = "round"
  ctx.lineJoin = "round"

  const selected = graph.nodes.find((node) => node.id === selectedId) ?? null
  const near = new Set<string>()
  if (selected) {
    near.add(selected.id)
    for (const link of graph.links) {
      const source = endNode(link.source)
      const target = endNode(link.target)
      if (source.id === selected.id) near.add(target.id)
      if (target.id === selected.id) near.add(source.id)
    }
  }

  for (const link of graph.links) {
    const source = endNode(link.source)
    const target = endNode(link.target)
    const mine = selected !== null && (source.id === selected.id || target.id === selected.id)
    const widthPx = (edgeWidth(link) + (mine ? 0.8 : 0)) / camera.k
    ctx.strokeStyle = edgeColor(link.tone, colors)
    ctx.globalAlpha = selected && !mine ? 0.08 : link.tone === "private" ? 0.55 : 0.9
    ctx.lineWidth = widthPx
    ctx.setLineDash(link.tone === "private" ? [4 / camera.k, 4 / camera.k] : [])
    drawCurve(ctx, link)
    ctx.stroke()
  }
  ctx.setLineDash([])
  ctx.globalAlpha = 1

  for (const node of graph.nodes) {
    const dim = selected !== null && !near.has(node.id)
    const marked = node.id === selectedId || node.id === hoverId
    ctx.globalAlpha = dim ? 0.16 : 1
    if (node.kind === "self" && !dim) {
      const glow = ctx.createRadialGradient(node.x, node.y, node.r, node.x, node.y, node.r * 3.4)
      glow.addColorStop(0, colors.glow)
      glow.addColorStop(1, "rgba(56, 189, 248, 0)")
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(node.x, node.y, node.r * 3.4, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.beginPath()
    ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2)
    const fill = nodeFill(node, colors)
    if (fill) {
      ctx.fillStyle = fill
      ctx.fill()
    }
    ctx.setLineDash(node.privateOnly ? [2.4 / camera.k, 2.6 / camera.k] : [])
    ctx.lineWidth = (marked ? 2.4 : 1.35) / camera.k
    ctx.strokeStyle = nodeStroke(node, colors, marked)
    ctx.stroke()
    ctx.setLineDash([])
  }
  ctx.globalAlpha = 1
  drawNames(ctx, graph, camera, colors, selectedId, hoverId, near)
}

function drawNames(
  ctx: CanvasRenderingContext2D,
  graph: Graph,
  camera: Camera,
  colors: Palette,
  selectedId: string | null,
  hoverId: string | null,
  near: Set<string>,
) {
  ctx.font = `600 ${12 / camera.k}px ui-sans-serif, system-ui, sans-serif`
  ctx.textAlign = "center"
  ctx.textBaseline = "top"
  ctx.lineJoin = "round"
  const boxes: [number, number, number, number][] = []
  const labeled = graph.nodes.filter((node) => {
    if (node.id === selectedId || node.id === hoverId) return true
    if (!node.name) return false
    if (near.has(node.id)) return true
    return camera.k >= 1.6
  })
  for (const node of labeled) {
    const text = node.id === "self" ? "You" : (node.name ?? node.label)
    const y = node.y + node.r + 7 / camera.k
    const textWidth = ctx.measureText(text).width
    const box: [number, number, number, number] = [
      node.x - textWidth / 2,
      y,
      node.x + textWidth / 2,
      y + 14 / camera.k,
    ]
    const pinned = node.id === selectedId || node.id === hoverId
    if (
      !pinned &&
      boxes.some((other) => box[0] < other[2] && box[2] > other[0] && box[1] < other[3] && box[3] > other[1])
    ) {
      continue
    }
    boxes.push(box)
    ctx.lineWidth = 3.5 / camera.k
    ctx.strokeStyle = colors.bg
    ctx.strokeText(text, node.x, y)
    ctx.fillStyle = colors.fg
    ctx.fillText(text, node.x, y)
  }
}

function nodeAt(
  graph: Graph,
  camera: Camera,
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
): GraphNode | null {
  const rect = canvas.getBoundingClientRect()
  const x = (clientX - rect.left - camera.x) / camera.k
  const y = (clientY - rect.top - camera.y) / camera.k
  let best: GraphNode | null = null
  let bestDistance = Infinity
  for (const node of graph.nodes) {
    const distance = Math.hypot(node.x - x, node.y - y)
    const hit = node.r + 9 / camera.k
    if (distance <= hit && distance < bestDistance) {
      best = node
      bestDistance = distance
    }
  }
  return best
}

function fitCamera(graph: Graph, width: number, height: number): Camera {
  if (graph.nodes.length === 0 || width < 20 || height < 20) return { x: 0, y: 0, k: 1 }
  const xs = graph.nodes.map((node) => node.x)
  const ys = graph.nodes.map((node) => node.y)
  const x0 = Math.min(...xs)
  const x1 = Math.max(...xs)
  const y0 = Math.min(...ys)
  const y1 = Math.max(...ys)
  const k = clampZoom(0.86 * Math.min(width / (x1 - x0 + 80), height / (y1 - y0 + 80)))
  return {
    k,
    x: width / 2 - (k * (x0 + x1)) / 2,
    y: height / 2 - (k * (y0 + y1)) / 2,
  }
}

export function NeighborhoodMesh({
  selfLabel,
  peers,
  expanded,
  expandedPubkey,
  isLoading,
  graphReady,
  onToggle,
}: NeighborhoodMeshProps) {
  const [selectedId, setSelectedId] = useState("self")
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const placesRef = useRef(new Map<string, { x: number; y: number }>())
  const cameraRef = useRef<Camera>({ x: 0, y: 0, k: 1 })
  const zoomRef = useRef<ZoomBehavior<HTMLCanvasElement, unknown> | null>(null)
  const applyingRef = useRef(false)
  const movedRef = useRef(false)
  const hoverRef = useRef<GraphNode | null>(null)
  const onToggleRef = useRef(onToggle)
  onToggleRef.current = onToggle
  const graph = useMemo(
    () => settleGraph(selfLabel, peers, expanded, placesRef.current),
    [expanded, peers, selfLabel],
  )
  const graphRef = useRef(graph)
  graphRef.current = graph
  const selectedRef = useRef(selectedId)
  selectedRef.current = selectedId
  const selected = graph.nodes.find((node) => node.id === selectedId) ?? graph.nodes[0] ?? null

  const paint = () => {
    const canvas = canvasRef.current
    const current = graphRef.current
    if (!canvas || !current) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const width = Math.max(1, rect.width)
    const height = Math.max(1, rect.height)
    const bitmapWidth = Math.round(width * dpr)
    const bitmapHeight = Math.round(height * dpr)
    if (canvas.width !== bitmapWidth || canvas.height !== bitmapHeight) {
      canvas.width = bitmapWidth
      canvas.height = bitmapHeight
    }
    drawGraph(
      ctx,
      current,
      cameraRef.current,
      selectedRef.current,
      hoverRef.current?.id ?? null,
      width,
      height,
      dpr,
      palette(Boolean(canvas.closest(".dark"))),
    )
  }
  const paintRef = useRef(paint)
  paintRef.current = paint

  const applyCamera = (camera: Camera) => {
    const canvas = canvasRef.current
    const behavior = zoomRef.current
    if (!canvas || !behavior) {
      cameraRef.current = camera
      paintRef.current()
      return
    }
    applyingRef.current = true
    select(canvas).call(
      behavior.transform,
      zoomIdentity.translate(camera.x, camera.y).scale(camera.k),
    )
    applyingRef.current = false
  }
  const applyCameraRef = useRef(applyCamera)
  applyCameraRef.current = applyCamera

  const fit = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    applyCameraRef.current(fitCamera(graphRef.current, canvas.clientWidth, canvas.clientHeight))
  }

  const scaleBy = (factor: number) => {
    const canvas = canvasRef.current
    const behavior = zoomRef.current
    if (!canvas || !behavior) return
    movedRef.current = true
    applyingRef.current = true
    select(canvas).call(behavior.scaleBy, factor)
    applyingRef.current = false
  }

  useLayoutEffect(() => {
    if (!movedRef.current) fit()
    else paintRef.current()
  }, [graph])

  useEffect(() => {
    paintRef.current()
  }, [selectedId])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let gesturing = false
    const behavior = zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([MIN_ZOOM, MAX_ZOOM])
      .clickDistance(3)
      .filter((event: { type: string; ctrlKey?: boolean; button?: number }) => {
        if (event.type === "dblclick") return false
        return (!event.ctrlKey || event.type === "wheel") && !event.button
      })
      .on("start", (event) => {
        if (applyingRef.current || !event.sourceEvent) return
        gesturing = true
        movedRef.current = true
        canvas.style.cursor = "grabbing"
      })
      .on("zoom", (event) => {
        if (!applyingRef.current && event.sourceEvent) movedRef.current = true
        const next = event.transform
        cameraRef.current = { x: next.x, y: next.y, k: next.k }
        paintRef.current()
      })
      .on("end", () => {
        gesturing = false
        canvas.style.cursor = ""
      })
    zoomRef.current = behavior
    const surface = select(canvas)
    surface.call(behavior)
    const camera = cameraRef.current
    applyingRef.current = true
    surface.call(behavior.transform, zoomIdentity.translate(camera.x, camera.y).scale(camera.k))
    applyingRef.current = false

    const onPointerMove = (event: PointerEvent) => {
      if (gesturing) return
      const hit = nodeAt(graphRef.current, cameraRef.current, canvas, event.clientX, event.clientY)
      if (hoverRef.current?.id !== hit?.id) {
        hoverRef.current = hit
        canvas.style.cursor = hit ? "pointer" : ""
        paintRef.current()
      }
    }
    const onClick = (event: MouseEvent) => {
      const hit = nodeAt(graphRef.current, cameraRef.current, canvas, event.clientX, event.clientY)
      if (!hit) {
        setSelectedId("self")
        return
      }
      setSelectedId(hit.id)
      if ((hit.kind === "public" || hit.kind === "expanded") && hit.pubkey) {
        onToggleRef.current(hit.pubkey)
      }
    }
    const onPointerLeave = () => {
      if (gesturing) return
      hoverRef.current = null
      canvas.style.cursor = ""
      paintRef.current()
    }
    const observer = new ResizeObserver(() => {
      if (!movedRef.current) {
        applyCameraRef.current(fitCamera(graphRef.current, canvas.clientWidth, canvas.clientHeight))
        return
      }
      paintRef.current()
    })
    observer.observe(canvas)
    canvas.addEventListener("pointermove", onPointerMove)
    canvas.addEventListener("click", onClick)
    canvas.addEventListener("pointerleave", onPointerLeave)
    return () => {
      zoomRef.current = null
      observer.disconnect()
      surface.on(".zoom", null)
      canvas.removeEventListener("pointermove", onPointerMove)
      canvas.removeEventListener("click", onClick)
      canvas.removeEventListener("pointerleave", onPointerLeave)
    }
  }, [])

  return (
    <div className="px-4 py-4">
      <div className="mb-3 flex items-center gap-4 text-[11px] text-zinc-500 dark:text-zinc-400">
        <LegendSwatch tone="own" label="Your channel" />
        <LegendSwatch tone="private" label="Private" />
        <LegendSwatch tone="gossip" label="Public" />
      </div>
      <div
        className="relative h-[520px] overflow-hidden rounded-lg bg-zinc-50 ring-1 ring-zinc-950/10 dark:bg-zinc-950 dark:ring-white/10"
        style={{ touchAction: "none" }}
      >
        <canvas ref={canvasRef} className="h-full w-full cursor-grab" />
        <div data-mesh-controls className="absolute top-2 right-2 z-10 flex items-center gap-1">
          <MeshControl label="Zoom out" onClick={() => scaleBy(1 / BUTTON_ZOOM)}>
            −
          </MeshControl>
          <MeshControl
            label="Fit neighborhood"
            wide
            onClick={() => {
              movedRef.current = false
              fit()
            }}
          >
            Fit
          </MeshControl>
          <MeshControl label="Zoom in" onClick={() => scaleBy(BUTTON_ZOOM)}>
            +
          </MeshControl>
        </div>
      </div>
      {selected ? (
        <MeshDetail
          node={selected}
          peers={peers}
          expanded={expanded}
          isLoading={isLoading}
          graphReady={graphReady}
          expandedPubkey={expandedPubkey}
        />
      ) : null}
    </div>
  )
}

function MeshControl({
  label,
  onClick,
  wide = false,
  children,
}: {
  label: string
  onClick: () => void
  wide?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`grid h-7 place-items-center rounded-md bg-white/95 text-xs font-medium text-zinc-700 ring-1 ring-zinc-950/10 hover:bg-zinc-50 dark:bg-zinc-900/95 dark:text-zinc-100 dark:ring-white/15 dark:hover:bg-zinc-800 ${
        wide ? "px-2" : "w-7"
      }`}
    >
      {children}
    </button>
  )
}

function MeshDetail({
  node,
  peers,
  expanded,
  isLoading,
  graphReady,
  expandedPubkey,
}: {
  node: GraphNode
  peers: NeighborhoodPeer[]
  expanded: NeighborhoodExpandedNode | null
  isLoading: boolean
  graphReady: boolean
  expandedPubkey: string | null
}) {
  if (node.kind === "self") {
    return (
      <DetailCard title={node.label} meta={`${peers.length} open ${peers.length === 1 ? "peer" : "peers"}`}>
        <Text className="text-xs text-zinc-500 dark:text-zinc-400">
          Your node is the filled circle. Each curve is a channel.
        </Text>
      </DetailCard>
    )
  }

  const peer = peers.find((item) => pubkeysEqual(item.pubkey, node.pubkey ?? ""))
  if (peer) {
    return (
      <DetailCard title={peer.label} meta={peer.hasPublicChannel ? "Your channel" : "Private channel"}>
        <ul className="space-y-1">
          {peer.channels.map((channel, index) => (
            <li key={`${channel.assetSymbol}-${index}`} className="text-xs text-zinc-600 dark:text-zinc-300">
              {channel.localBalanceDisplay} local / {channel.remoteBalanceDisplay} remote ·{" "}
              {channel.isPublic ? "public" : "private"}
            </li>
          ))}
        </ul>
        {peer.hasPublicChannel ? (
          <Text className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            {peer.publicLinks.length === 0
              ? graphReady
                ? "No other public channels announced for this peer."
                : "Public links appear after gossip syncs."
              : `${peer.publicLinks.length} public ${peer.publicLinks.length === 1 ? "connection" : "connections"}.`}
            {peer.hiddenPublicLinkCount > 0 ? ` ${peer.hiddenPublicLinkCount} more not drawn.` : ""}
          </Text>
        ) : (
          <Text className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            Only you and this peer can see {peer.channels.length === 1 ? "this channel" : "these channels"}.
          </Text>
        )}
      </DetailCard>
    )
  }

  const link = findLink(peers, expanded, node.pubkey ?? "")
  const open = node.pubkey !== null && expandedPubkey !== null && pubkeysEqual(node.pubkey, expandedPubkey)
  return (
    <DetailCard title={node.label} meta="Public channel">
      {link ? (
        <Text className="text-xs text-zinc-600 dark:text-zinc-300">
          {link.capacityDisplay} · {link.channelCount === 1 ? "1 channel" : `${link.channelCount} channels`}
        </Text>
      ) : null}
      <Text className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
        {isLoading && open
          ? "Loading public channels…"
          : open
            ? "Its public channels are on the map."
            : "Click this cell to open who it connects to."}
      </Text>
    </DetailCard>
  )
}

function findLink(
  peers: NeighborhoodPeer[],
  expanded: NeighborhoodExpandedNode | null,
  pubkey: string,
): NeighborhoodPublicLink | null {
  for (const peer of peers) {
    const link = peer.publicLinks.find((item) => pubkeysEqual(item.pubkey, pubkey))
    if (link) return link
  }
  return expanded?.publicLinks.find((item) => pubkeysEqual(item.pubkey, pubkey)) ?? null
}

function DetailCard({
  title,
  meta,
  children,
}: {
  title: string
  meta: string
  children: ReactNode
}) {
  return (
    <div className="mt-2 rounded-lg bg-zinc-50 px-4 py-3 dark:bg-zinc-800/60">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-zinc-950 dark:text-white">{title}</p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{meta}</p>
      </div>
      <div className="mt-2">{children}</div>
    </div>
  )
}

function LegendSwatch({ tone, label }: { tone: MeshEdgeTone; label: string }) {
  const mark =
    tone === "private"
      ? "border-t border-dashed border-zinc-500"
      : tone === "gossip"
        ? "bg-sky-400 dark:bg-sky-400"
        : "bg-zinc-700 dark:bg-zinc-200"
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-px w-5 ${mark}`} />
      {label}
    </span>
  )
}
