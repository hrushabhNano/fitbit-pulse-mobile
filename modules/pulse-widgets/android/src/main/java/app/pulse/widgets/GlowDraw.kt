package app.pulse.widgets

import android.graphics.BlurMaskFilter
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.Shader
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.sin

/*
 * The glow design's light and dot numbers on an android.graphics.Canvas, for the glow widgets (GlowWidgets.kt). The
 * same recipe as the app's cards (src/glow/light.ts, src/glow/dotFont.ts), which port unstrap's GlowStyle.kt, LightSpec.kt
 * and DotSpec.kt (MIT, docs/design/glow.md). Sizes are in dp; the caller scales the canvas by the density.
 */

/** Each metric's ink (src/glow/tokens.ts INK). */
internal object Ink {
  val recovery = 0xFF7CF2C9.toInt()
  val energy = 0xFFF66C28.toInt()
  val steps = 0xFFC3F53C.toInt()
  val sleepDeep = 0xFF4C6FFF.toInt()
  val sleepLight = 0xFF8FA8FF.toInt()
  val sleepRem = 0xFFB37CFF.toInt()
  val sleepAwake = 0xFFFFB547.toInt()
  val heart = 0xFFFF5A5F.toInt()
  val evening = 0xFFA274F2.toInt()
  const val CARD = 0xFF0A0A0B.toInt()
  fun parse(hex: String?, fallback: Int): Int = try { if (hex.isNullOrBlank()) fallback else Color.parseColor(hex) } catch (_: IllegalArgumentException) { fallback }
}

internal enum class Mood(val glow: Float, val tone: Boolean, val belowOnly: Boolean) {
  DAY(1f, true, false), EVENING(.8f, false, false), NIGHT(.65f, true, true);
  companion object { fun of(name: String?) = when (name) { "evening" -> EVENING; "night" -> NIGHT; else -> DAY } }
}

/** A glow card's look, all from one colour (src/glow/light.ts GlowStyle). */
internal data class Look(
  val color: Int,
  val angle: Float?,
  val level: Float? = null,
  val rim: Float = 1f,
  val second: Boolean = false,
  val radial: Boolean = true,
  val coreX: Float = .5f, val coreY: Float = .6f, val coreW: Float = .95f, val coreH: Float = .75f,
  val coreBlur: Float = 30f,
  val coreLightness: Float = .09f,
  val toneShift: Float = -10f,
  val toneWidth: Float = 16f,
  val glowSize: Float = 30f,
  val bodyLightness: Float = .32f,
  val bodyHue: Float = -4f,
  val coreHue: Float = 0f,
  val grain: Float = .06f,
  val mood: Mood = Mood.DAY,
) {
  companion object {
    fun hero(color: Int, angle: Float?, rim: Float = 1f, mood: Mood = Mood.DAY) = Look(color, angle, rim = rim, mood = mood)
    fun lime(color: Int) = Look(color, 45f, bodyHue = 30f, toneShift = 30f, coreHue = 30f)
    fun level(color: Int, level: Float, across: Boolean = false) = Look(
      color, if (across) 180f else 270f, level = level.coerceIn(0f, 1f),
      coreX = .5f, coreY = .05f, coreW = 1.4f, coreH = 1.2f, coreBlur = 32f, coreLightness = .02f, toneShift = -15f, toneWidth = 26f, glowSize = 34f,
    )
  }
}

// ── Colour ───────────────────────────────────────────────────────────────────

private fun hsl(h: Float, s: Float, l: Float): Int {
  val hue = ((h % 360f) + 360f) % 360f
  val c = (1f - abs(2f * l.coerceIn(0f, 1f) - 1f)) * s.coerceIn(0f, 1f)
  val x = c * (1f - abs((hue / 60f) % 2f - 1f))
  val m = l.coerceIn(0f, 1f) - c / 2f
  val (r, g, b) = when {
    hue < 60 -> Triple(c, x, 0f); hue < 120 -> Triple(x, c, 0f); hue < 180 -> Triple(0f, c, x)
    hue < 240 -> Triple(0f, x, c); hue < 300 -> Triple(x, 0f, c); else -> Triple(c, 0f, x)
  }
  return Color.argb(255, ((r + m) * 255).toInt().coerceIn(0, 255), ((g + m) * 255).toInt().coerceIn(0, 255), ((b + m) * 255).toInt().coerceIn(0, 255))
}

private fun hslOf(c: Int): Triple<Float, Float, Float> {
  val r = Color.red(c) / 255f; val g = Color.green(c) / 255f; val b = Color.blue(c) / 255f
  val mx = max(r, max(g, b)); val mn = min(r, min(g, b)); val l = (mx + mn) / 2f; val d = mx - mn
  if (d == 0f) return Triple(0f, 0f, l)
  val s = d / (1f - abs(2f * l - 1f))
  val h = when (mx) { r -> (((g - b) / d) % 6f + 6f) % 6f; g -> (b - r) / d + 2f; else -> (r - g) / d + 4f } * 60f
  return Triple(h, s, l)
}

private fun luminance(c: Int): Float {
  fun lin(v: Int): Float { val x = v / 255f; return if (x <= .04045f) x / 12.92f else ((x + .055f) / 1.055f).pow(2.4f) }
  return .2126f * lin(Color.red(c)) + .7152f * lin(Color.green(c)) + .0722f * lin(Color.blue(c))
}

internal fun withAlpha(c: Int, a: Float) = (c and 0x00FFFFFF) or ((a.coerceIn(0f, 1f) * 255).toInt() shl 24)

private fun mix(a: Int, b: Int, t: Float): Int {
  val k = t.coerceIn(0f, 1f)
  fun ch(x: Int, y: Int) = (x + (y - x) * k).toInt().coerceIn(0, 255)
  return Color.argb(ch(Color.alpha(a), Color.alpha(b)), ch(Color.red(a), Color.red(b)), ch(Color.green(a), Color.green(b)), ch(Color.blue(a), Color.blue(b)))
}

private fun capped(h: Float, s: Float, l: Float, maxLum: Float): Int {
  var x = l
  while (x > .08f) { val c = hsl(h, s, x); if (luminance(c) <= maxLum) return c; x -= .01f }
  return hsl(h, s, .08f)
}

// ── Light ────────────────────────────────────────────────────────────────────

private fun vector(angle: Float): Pair<Float, Float> {
  val r = angle / 180f * PI.toFloat()
  fun clean(v: Float) = if (abs(v) < 1e-6f) 0f else v
  return clean(cos(r)) to clean(-sin(r))
}

private class Fill(val at: Float, val light: Float)

/** Draws a glow card's light (fill, rim, dark core, tone band, gloss and hairline) over [w] by [h] dp, clipped to [r]. */
internal fun drawGlow(canvas: Canvas, look: Look, w: Float, h: Float, r: Float) {
  val angle = if (look.mood.belowOnly && look.angle != null) 270f else look.angle
  val level = look.level?.let { if (it.isNaN()) .12f else it.coerceIn(.12f, 1f) }
  val fromAbove = angle != null && vector(angle).second < 0f
  val across = level != null && angle == 180f
  val l3 = look.second && level == null
  val brightness = if (level != null) 1f else look.mood.glow
  // Palette.
  val (hue, s0, l0) = hslOf(look.color)
  val s = if (s0 < .12f) s0 else s0.coerceIn(.35f, .9f)
  val rimColor = if (level != null) look.color else hsl(hue, s * .9f, (l0 + .03f).coerceIn(.45f, .6f))
  val body = if (level != null) hsl(hue, s0, .16f) else capped(hue + look.bodyHue, s * .85f, look.bodyLightness, .18f)
  val band = capped(hue + look.toneShift, s * .8f, look.bodyLightness - .04f, .14f)
  val core = hsl(hue + look.coreHue, .7f, look.coreLightness)
  fun dim(c: Int) = if (brightness < 1f) mix(Color.BLACK, c, brightness) else c
  val light = dim(rimColor); val mid = dim(body); val tone = dim(band)

  canvas.save()
  val card = Path().apply { addRoundRect(RectF(0f, 0f, w, h), r, r, Path.Direction.CW) }
  canvas.clipPath(card)
  // Fill.
  val stops = when {
    level != null -> listOf(Fill(0f, 1f), Fill(.35f * level, .55f), Fill(.85f * level, 0f))
    l3 -> listOf(Fill(0f, .7f), Fill(.28f, 0f))
    else -> listOf(Fill(0f, 1f), Fill(.16f, .5f), Fill(.45f, 0f))
  }
  val fill = Paint(Paint.ANTI_ALIAS_FLAG)
  if (angle == null) fill.color = mid else {
    val (vx, vy) = vector(angle)
    val half = (abs(w * vx) + abs(h * vy)) / 2f
    val colors = (stops.map { mix(mid, light, it.light) } + mid).toIntArray()
    val pos = (stops.map { it.at.coerceIn(0f, 1f) } + 1f).toFloatArray()
    fill.shader = LinearGradient(w / 2 + vx * half, h / 2 + vy * half, w / 2 - vx * half, h / 2 - vy * half, colors, pos, Shader.TileMode.CLAMP)
  }
  canvas.drawRect(0f, 0f, w, h, fill)
  // Rim: an inset shadow leaning toward the lit edge; on a level card only over the lit part.
  val rim = look.rim * if (l3) .7f else 1f
  if (rim > 0f) {
    canvas.save()
    if (level != null) {
      val len = if (across) w else h
      val dark = min((1f - level - .11f) * len, (1f - .85f * level) * len - 22f)
      when { across -> canvas.clipRect(0f, 0f, w - dark, h); fromAbove -> canvas.clipRect(0f, 0f, w, h - dark); else -> canvas.clipRect(0f, dark, w, h) }
    }
    val g = look.glowSize * max(1f, rim)
    val (dx, dy, blur, spread, alpha) = if (angle != null) {
      val (vx, vy) = vector(angle)
      listOf(-vx * g * .6f, -vy * g * .6f, g * 1.2f, -g * .5f, min(1f, rim))
    } else listOf(0f, 0f, g, g * .1f, min(1f, .6f * rim))
    val pad = blur * 2 + abs(dx) + abs(dy) + abs(spread) + 4f
    val hole = max(0f, r - spread)
    val path = Path().apply {
      fillType = Path.FillType.EVEN_ODD
      addRect(-pad, -pad, w + pad, h + pad, Path.Direction.CW)
      addRoundRect(RectF(spread + dx, spread + dy, w - spread + dx, h - spread + dy), hole, hole, Path.Direction.CW)
    }
    canvas.drawPath(path, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = withAlpha(light, alpha); maskFilter = blurOf(blur / 2f) })
    canvas.restore()
  }
  // Dark core.
  val margin = max(w, h) * .08f
  if (level != null) {
    val len = if (across) w else h
    val clear = (1f - .85f * level) * len
    val dark = min((1f - level - .11f) * len, clear - 22f)
    val (y0, y1) = when { across -> (w + margin) to -margin; fromAbove -> (h + margin) to -margin; else -> -margin to (h + margin) }
    val span = abs(y1 - y0)
    fun at(x: Float) = ((x + margin) / span).coerceIn(0f, 1f)
    val colors = ArrayList<Int>(); val pos = ArrayList<Float>()
    colors += core; pos += 0f
    for (i in 0..10) { val t = i / 10f; val fade = t * t * (3 - 2 * t); colors += withAlpha(core, 1f - fade); pos += at(dark + (clear - dark) * t) }
    colors += Color.TRANSPARENT; pos += 1f
    for (i in 1 until pos.size) if (pos[i] < pos[i - 1]) pos[i] = pos[i - 1]
    val shader = if (across) LinearGradient(y0, 0f, y1, 0f, colors.toIntArray(), pos.toFloatArray(), Shader.TileMode.CLAMP)
    else LinearGradient(0f, y0, 0f, y1, colors.toIntArray(), pos.toFloatArray(), Shader.TileMode.CLAMP)
    canvas.drawRect(-margin, -margin, w + margin, h + margin, Paint().apply { this.shader = shader })
  } else {
    val (cx, cy) = if (angle != null) { val (vx, vy) = vector(angle); (.5f - .38f * vx) to (.5f - .38f * vy) } else look.coreX to look.coreY
    val cw = w * look.coreW; val ch = h * look.coreH
    val box = RectF(w * cx - cw / 2, h * cy - ch / 2, w * cx + cw / 2, h * cy + ch / 2)
    val bandW = if (look.mood.tone) look.toneWidth else 0f
    val blur = blurOf(look.coreBlur)
    if (bandW > 0f) {
      val t = RectF(box.left - bandW, box.top - bandW, box.right + bandW, box.bottom + bandW)
      val p = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = tone; maskFilter = blur }
      if (look.radial) canvas.drawOval(t, p) else canvas.drawRoundRect(t, r - 8f + bandW, r - 8f + bandW, p)
    }
    val p = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = core; maskFilter = blur }
    if (look.radial) canvas.drawOval(box, p) else canvas.drawRoundRect(box, r - 8f, r - 8f, p)
  }
  canvas.restore()
  // Hairline and its gloss along the lit edge.
  val edge = RectF(.5f, .5f, w - .5f, h - .5f)
  canvas.drawRoundRect(edge, r - .5f, r - .5f, Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeWidth = 1f; color = 0x1FFFFFFF })
  val reverse = level != null && !fromAbove && !across
  val gc = if (reverse) intArrayOf(0x0AFFFFFF, 0x14FFFFFF, 0x59FFFFFF) else intArrayOf(0x59FFFFFF, 0x14FFFFFF, 0x0AFFFFFF)
  val gp = if (reverse) floatArrayOf(0f, .75f, 1f) else floatArrayOf(0f, .25f, 1f)
  val gloss = if (across) LinearGradient(0f, 0f, w, 0f, gc, gp, Shader.TileMode.CLAMP) else LinearGradient(0f, 0f, 0f, h, gc, gp, Shader.TileMode.CLAMP)
  canvas.drawRoundRect(edge, r - .5f, r - .5f, Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeWidth = 1f; shader = gloss })
}

private fun blurOf(sigma: Float): BlurMaskFilter? = if (sigma > .5f) BlurMaskFilter((sigma - .5f) / .57735f, BlurMaskFilter.Blur.NORMAL) else null

/** A picture card's surface (#0A0A0B) with its 8% hairline. */
internal fun drawPictureCard(canvas: Canvas, w: Float, h: Float, r: Float) {
  canvas.drawRoundRect(RectF(0f, 0f, w, h), r, r, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Ink.CARD })
  canvas.drawRoundRect(RectF(.5f, .5f, w - .5f, h - .5f), r - .5f, r - .5f, Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeWidth = 1f; color = 0x14FFFFFF })
}

// ── Dot numbers ──────────────────────────────────────────────────────────────

/** The 5×7 dot font (src/glow/dotFont.ts). */
internal object DotFont {
  private val GLYPHS: Map<Char, List<String>> = mapOf(
    '0' to listOf(".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."),
    '1' to listOf("..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."),
    '2' to listOf(".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"),
    '3' to listOf("####.", "....#", "....#", ".###.", "....#", "....#", "####."),
    '4' to listOf("...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."),
    '5' to listOf("#####", "#....", "####.", "....#", "....#", "#...#", ".###."),
    '6' to listOf("..##.", ".#...", "#....", "####.", "#...#", "#...#", ".###."),
    '7' to listOf("#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."),
    '8' to listOf(".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."),
    '9' to listOf(".###.", "#...#", "#...#", ".####", "....#", "...#.", ".##.."),
    '.' to listOf(".", ".", ".", ".", ".", ".", "#"),
    ',' to listOf(".", ".", ".", ".", ".", "#", "#"),
    ':' to listOf(".", ".", "#", ".", ".", "#", "."),
    '-' to listOf("...", "...", "...", "###", "...", "...", "..."),
    '−' to listOf("...", "...", "...", "###", "...", "...", "..."),
    '+' to listOf("...", "...", ".#.", "###", ".#.", "...", "..."),
    '%' to listOf("##...", "##..#", "...#.", "..#..", ".#...", "#..##", "...##"),
    ' ' to listOf("..", "..", "..", "..", "..", "..", ".."),
  )
  const val GAP = .38f
  fun glyph(c: Char) = GLYPHS[c] ?: GLYPHS.getValue(' ')
  fun columns(text: String) = text.sumOf { glyph(it)[0].length } + max(0, text.length - 1)
  fun width(text: String, dot: Float) = (dot + dot * GAP) * columns(text) - dot * GAP
  fun height(dot: Float) = (dot + dot * GAP) * 7 - dot * GAP
  /** The dot size that fits [text] into [room] dp, at most [dot]. */
  fun fit(text: String, dot: Float, room: Float) = min(dot, dot * room / max(1f, width(text, dot)))

  /** Draws [text] with its top left at ([x], [y]). */
  fun draw(canvas: Canvas, text: String, x: Float, y: Float, dot: Float, color: Int = Color.WHITE) {
    val pitch = dot * (1 + GAP)
    val p = Paint(Paint.ANTI_ALIAS_FLAG).apply { this.color = color }
    var x0 = x
    for (c in text) {
      val rows = glyph(c)
      rows.forEachIndexed { row, line -> line.forEachIndexed { col, ch -> if (ch == '#') canvas.drawCircle(x0 + col * pitch + dot / 2, y + row * pitch + dot / 2, dot / 2, p) } }
      x0 += (rows[0].length + 1) * pitch
    }
  }
}
