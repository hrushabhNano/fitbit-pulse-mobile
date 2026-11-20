package app.pulse.widgets

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import android.net.Uri
import android.os.Bundle
import android.text.Layout
import android.text.StaticLayout
import android.text.TextPaint
import android.text.TextUtils
import android.widget.RemoteViews
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import kotlin.math.max
import kotlin.math.min

/*
 * The glow widgets, after unstrap's widget set (Today, Recovery, Sleep, Steps): one bitmap per widget, drawn with the
 * app's light, dot numbers and Funnel type (GlowDraw.kt), from the `glow` part of the widget snapshot
 * (src/glow/widget.ts). Each resizes freely and lays itself out as a Small, a Wide or a Large from the size the launcher
 * gives it. Always dark, as the app is. The whole widget opens its tab.
 */

enum class GlowKind { TODAY, RECOVERY, SLEEP, STEPS }

open class GlowWidgetProvider(private val kind: GlowKind) : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) { ids.forEach { renderGlowWidget(context, manager, it, kind) } }
  override fun onAppWidgetOptionsChanged(context: Context, manager: AppWidgetManager, id: Int, options: Bundle) { renderGlowWidget(context, manager, id, kind) }
}
class GlowTodayWidgetProvider : GlowWidgetProvider(GlowKind.TODAY)
class GlowRecoveryWidgetProvider : GlowWidgetProvider(GlowKind.RECOVERY)
class GlowSleepWidgetProvider : GlowWidgetProvider(GlowKind.SLEEP)
class GlowStepsWidgetProvider : GlowWidgetProvider(GlowKind.STEPS)

internal val GLOW_PROVIDERS = listOf(
  GlowTodayWidgetProvider::class.java to GlowKind.TODAY,
  GlowRecoveryWidgetProvider::class.java to GlowKind.RECOVERY,
  GlowSleepWidgetProvider::class.java to GlowKind.SLEEP,
  GlowStepsWidgetProvider::class.java to GlowKind.STEPS,
)

internal fun updateGlowWidgets(context: Context) {
  val manager = AppWidgetManager.getInstance(context)
  GLOW_PROVIDERS.forEach { (provider, kind) -> manager.getAppWidgetIds(ComponentName(context, provider)).forEach { renderGlowWidget(context, manager, it, kind) } }
}

internal fun hasGlowWidgets(context: Context): Boolean {
  val manager = AppWidgetManager.getInstance(context)
  return GLOW_PROVIDERS.any { (provider, _) -> manager.getAppWidgetIds(ComponentName(context, provider)).isNotEmpty() }
}

internal fun renderGlowWidget(context: Context, manager: AppWidgetManager, id: Int, kind: GlowKind) {
  val options = manager.getAppWidgetOptions(id)
  val landscape = context.resources.configuration.orientation == Configuration.ORIENTATION_LANDSCAPE
  val width = options.getInt(if (landscape) AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH else AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 170).coerceIn(100, 800)
  val height = options.getInt(if (landscape) AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT else AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 170).coerceIn(100, 800)
  manager.updateAppWidget(id, glowViews(context, id, kind, WidgetCache.read(context), width.toFloat(), height.toFloat(), System.currentTimeMillis() / 1000))
}

/** Host-independent: the JVM tests draw these exact views. */
internal fun glowViews(context: Context, id: Int, kind: GlowKind, snapshot: JSONObject?, width: Float, height: Float, now: Long): RemoteViews {
  val art = GlowArt(context)
  val zone = TimeZone.getTimeZone(snapshot?.optString("timeZone")?.takeIf { it.isNotBlank() } ?: TimeZone.getDefault().id)
  val today = SimpleDateFormat("yyyy-MM-dd", Locale.ROOT).apply { timeZone = zone }.format(Date(now * 1000))
  val glow = if (snapshot != null && snapshot.optString("day") == today) snapshot.optJSONObject("glow") else null
  val synced = snapshot?.optDouble("lastSyncTs", Double.NaN)?.takeIf { it.isFinite() && it > 0 }?.toLong()
  val stale = glow != null && snapshot?.optString("source") != "demo" && (synced == null || now - synced > 3 * 60 * 60)
  val labels = snapshot?.optJSONObject("labels")
  val staleText = labels?.optString("stale")?.takeIf { it.isNotBlank() } ?: context.getString(R.string.pulse_widget_stale)
  val demoText = if (snapshot?.optString("source") == "demo") labels?.optString("demo")?.takeIf { it.isNotBlank() } else null
  val footer = demoText ?: if (stale) staleText else null
  val views = RemoteViews(context.packageName, R.layout.glow_widget)
  val (bitmap, description, href) = art.draw(kind, glow, width, height, footer)
  views.setImageViewBitmap(R.id.glow_art, bitmap)
  views.setContentDescription(R.id.glow_art, description)
  val target = href.takeIf { it.startsWith("pulse://") }?.let { if (it == "pulse://") "pulse:///" else it } ?: "pulse:///"
  val intent = Intent(Intent.ACTION_VIEW, Uri.parse(target)).setPackage(context.packageName).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
  views.setOnClickPendingIntent(R.id.glow_root, PendingIntent.getActivity(context, 10_000 + id, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
  return views
}

/** The glow widgets' drawing: one bitmap per widget, laid out as a Small, a Wide or a Large. */
internal class GlowArt(private val context: Context) {
  private val density = context.resources.displayMetrics.density.coerceIn(1f, 3f)
  private val fontScale = context.resources.configuration.fontScale.coerceIn(1f, 1.2f)
  private val displayLight: Typeface = context.resources.getFont(R.font.funnel_display_light)
  private val displayMedium: Typeface = context.resources.getFont(R.font.funnel_display_medium)
  private val sans: Typeface = context.resources.getFont(R.font.funnel_sans_regular)
  private val sansMedium: Typeface = context.resources.getFont(R.font.funnel_sans_medium)

  private enum class Bucket { SMALL, WIDE, LARGE }
  private fun bucket(w: Float, h: Float) = when { w < 230f -> Bucket.SMALL; h < 230f -> Bucket.WIDE; else -> Bucket.LARGE }

  private fun text(face: Typeface, size: Float, color: Int = 0xFFFFFFFF.toInt()) = TextPaint(Paint.ANTI_ALIAS_FLAG).apply { typeface = face; textSize = size * fontScale; this.color = color }
  private val title get() = text(sansMedium, 15f)
  private val note get() = text(sans, 12f, 0xB8FFFFFF.toInt())
  private val body get() = text(sans, 13f, 0xB8FFFFFF.toInt())
  private fun sentence(size: Float) = text(displayLight, size).apply { letterSpacing = -.01f }

  /** One line, ellipsized to [room]; returns its height. */
  private fun line(c: Canvas, s: String, x: Float, top: Float, room: Float, p: TextPaint, right: Boolean = false): Float {
    val t = TextUtils.ellipsize(s, p, max(0f, room), TextUtils.TruncateAt.END).toString()
    val fm = p.fontMetrics
    val drawX = if (right) x + room - p.measureText(t) else x
    c.drawText(t, drawX, top - fm.ascent, p)
    return fm.descent - fm.ascent
  }

  /** Wrapped text, at most [lines] lines; returns its height. */
  private fun block(c: Canvas, s: String, x: Float, top: Float, room: Float, p: TextPaint, lines: Int): Float {
    if (s.isBlank() || lines <= 0) return 0f
    val layout = StaticLayout.Builder.obtain(s, 0, s.length, p, max(1, room.toInt()))
      .setMaxLines(lines).setEllipsize(TextUtils.TruncateAt.END).setAlignment(Layout.Alignment.ALIGN_NORMAL).setLineSpacing(0f, 1.08f).build()
    c.save(); c.translate(x, top); layout.draw(c); c.restore()
    return layout.height.toFloat()
  }

  private fun blank(w: Float, h: Float, draw: (Canvas) -> Unit): Bitmap {
    val bitmap = Bitmap.createBitmap(max(1, (w * density).toInt()), max(1, (h * density).toInt()), Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    canvas.scale(density, density)
    draw(canvas)
    return bitmap
  }

  /** The widget's bitmap, what TalkBack reads, and what it opens. */
  fun draw(kind: GlowKind, glow: JSONObject?, w: Float, h: Float, footer: String?): Triple<Bitmap, String, String> {
    val r = 28f
    val pad = 18f
    if (glow == null) return waiting(kind, w, h, r, pad)
    val b = bucket(w, h)
    return when (kind) {
      GlowKind.TODAY -> today(glow, b, w, h, r, pad, footer)
      GlowKind.RECOVERY -> recovery(glow.optJSONObject("recovery") ?: JSONObject(), b, w, h, r, pad, footer)
      GlowKind.SLEEP -> sleep(glow.optJSONObject("sleep") ?: JSONObject(), b, w, h, r, pad, footer)
      GlowKind.STEPS -> steps(glow.optJSONObject("steps") ?: JSONObject(), b, w, h, r, pad, footer)
    }
  }

  private fun titleOf(kind: GlowKind) = context.getString(when (kind) {
    GlowKind.TODAY -> R.string.glow_widget_today_title
    GlowKind.RECOVERY -> R.string.pulse_widget_metric_recovery
    GlowKind.SLEEP -> R.string.pulse_widget_metric_sleep
    GlowKind.STEPS -> R.string.pulse_widget_metric_steps
  })

  private fun waiting(kind: GlowKind, w: Float, h: Float, r: Float, pad: Float): Triple<Bitmap, String, String> {
    val title = titleOf(kind)
    val message = context.getString(R.string.glow_widget_open)
    val bmp = blank(w, h) { c ->
      drawPictureCard(c, w, h, r)
      line(c, title, pad, pad, w - pad * 2, this.title)
      block(c, message, pad, h - pad - 40f, w - pad * 2, body, 2)
    }
    return Triple(bmp, "$title, $message", "pulse:///")
  }

  private fun footerLine(c: Canvas, footer: String?, w: Float, h: Float, pad: Float) {
    if (footer != null) line(c, footer, pad, h - pad - 14f, w - pad * 2, text(sansMedium, 11f, 0xFFFFB547.toInt()))
  }

  /** The bottom edge content may reach: above the footer when there is one. */
  private fun bottom(h: Float, pad: Float, footer: String?) = h - pad - if (footer != null) 20f else 0f

  // ── Today ─────────────────────────────────────────────────────────────────

  private fun today(g: JSONObject, b: Bucket, w: Float, h: Float, r: Float, pad: Float, footer: String?): Triple<Bitmap, String, String> {
    val hero = g.optJSONObject("hero") ?: JSONObject()
    val title = hero.optString("title")
    val sentenceText = hero.optString("sentence")
    val value = hero.optString("value").takeIf { !hero.isNull("value") && it.isNotBlank() }
    val unit = hero.optString("unit")
    val angle = if (hero.isNull("angle")) null else hero.optDouble("angle", 270.0).toFloat()
    val look = Look.hero(Ink.parse(hero.optString("ink"), Ink.recovery), angle, hero.optDouble("rim", 1.0).toFloat(), Mood.of(hero.optString("mood")))
    val bmp = blank(w, h) { c ->
      drawGlow(c, look, w, h, r)
      val inner = w - pad * 2
      line(c, title, pad, pad, inner, this.title)
      val end = bottom(h, pad, footer)
      val dot = if (b == Bucket.SMALL) 3.6f else 4.5f
      val lines = when (b) { Bucket.SMALL -> if (value != null) 0 else 4; Bucket.WIDE -> 2; Bucket.LARGE -> 4 }
      block(c, sentenceText, pad, pad + 30f, inner, sentence(if (b == Bucket.SMALL) 16f else 18f), lines)
      if (value != null) {
        val d = DotFont.fit(value, dot, inner * if (b == Bucket.SMALL) 1f else .7f)
        DotFont.draw(c, value, pad, end - DotFont.height(d), d)
        if (unit.isNotBlank()) line(c, unit, pad + DotFont.width(value, d) + 8f, end - 18f, inner - DotFont.width(value, d) - 8f, body)
      }
      footerLine(c, footer, w, h, pad)
    }
    return Triple(bmp, listOf(title, sentenceText, listOfNotNull(value, unit).joinToString(" ")).filter { it.isNotBlank() }.joinToString(". "), hero.optString("href"))
  }

  // ── Recovery ──────────────────────────────────────────────────────────────

  private fun recovery(g: JSONObject, b: Bucket, w: Float, h: Float, r: Float, pad: Float, footer: String?): Triple<Bitmap, String, String> {
    val title = g.optString("title")
    val score = g.optString("score").takeIf { !g.isNull("score") && it.isNotBlank() }
    val word = g.optString("word")
    val noteText = g.optString("note")
    val week = g.optJSONArray("week").numbers()
    val bmp = blank(w, h) { c ->
      drawGlow(c, Look.hero(Ink.recovery, 225f), w, h, r)
      val inner = w - pad * 2
      val noteW = if (b == Bucket.SMALL || noteText.isBlank()) 0f else min(inner * .5f, note.measureText(noteText) + 4f)
      line(c, title, pad, pad, inner - noteW - 8f, this.title)
      if (noteW > 0f) line(c, noteText, pad + inner - noteW, pad + 2f, noteW, note, right = true)
      val end = bottom(h, pad, footer)
      if (score == null) {
        block(c, g.optString("waiting").ifBlank { g.optString("sentence") }, pad, end - 40f, inner, body, 2)
      } else {
        if (b == Bucket.LARGE) block(c, g.optString("sentence"), pad, pad + 32f, inner, sentence(18f), 3)
        val dot = if (b == Bucket.SMALL) DotFont.fit(score, 4.5f, inner) else 4.5f
        val numH = DotFont.height(dot)
        val wordH = 18f
        DotFont.draw(c, score, pad, end - wordH - 6f - numH, dot)
        line(c, word, pad, end - wordH, inner, body)
        if (b != Bucket.SMALL && week.any { it != null }) {
          val left = pad + DotFont.width(score, dot) + 24f
          trendDots(c, week, left, end - wordH - numH, w - pad - left, numH)
        }
      }
      footerLine(c, footer, w, h, pad)
    }
    return Triple(bmp, listOfNotNull(title, score?.let { "$it, $word" } ?: g.optString("waiting"), noteText.takeIf { it.isNotBlank() }).joinToString(". "), g.optString("href"))
  }

  /** A dot a day joined by a thin line, today the only full dot. */
  private fun trendDots(c: Canvas, values: List<Float?>, x: Float, y: Float, w: Float, h: Float) {
    if (w < 40f) return
    val known = values.filterNotNull()
    val lo = known.min(); val hi = known.max()
    val n = values.size
    fun px(i: Int) = x + 8f + i * (w - 16f) / max(1, n - 1)
    fun py(v: Float) = if (hi == lo) y + h / 2 else y + h - 6f - (v - lo) / (hi - lo) * (h - 12f)
    val line = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0x59FFFFFF; strokeWidth = 1.5f; style = Paint.Style.STROKE }
    var prev: Pair<Float, Float>? = null
    values.forEachIndexed { i, v -> if (v == null) prev = null else { val p = px(i) to py(v); prev?.let { c.drawLine(it.first, it.second, p.first, p.second, line) }; prev = p } }
    val dim = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0x8CFFFFFF.toInt() }
    val full = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFFFFFFFF.toInt() }
    values.forEachIndexed { i, v -> if (v != null) c.drawCircle(px(i), py(v), if (i == n - 1) 5f else 3f, if (i == n - 1) full else dim) }
  }

  // ── Sleep ─────────────────────────────────────────────────────────────────

  private fun sleep(g: JSONObject, b: Bucket, w: Float, h: Float, r: Float, pad: Float, footer: String?): Triple<Bitmap, String, String> {
    val title = g.optString("title")
    val score = g.optString("score").takeIf { !g.isNull("score") && it.isNotBlank() }
    val asleep = g.optString("asleep").takeIf { !g.isNull("asleep") && it.isNotBlank() }
    val st = g.optJSONObject("stages") ?: JSONObject()
    val parts = listOf("deep" to Ink.sleepDeep, "rem" to Ink.sleepRem, "light" to Ink.sleepLight, "awake" to Ink.sleepAwake).map { (k, col) -> Triple(k, st.optDouble(k, 0.0).toFloat(), col) }
    val bmp = blank(w, h) { c ->
      drawGlow(c, Look.hero(Ink.sleepDeep, 270f, mood = Mood.NIGHT), w, h, r)
      val inner = w - pad * 2
      line(c, title, pad, pad, inner, this.title)
      val end = bottom(h, pad, footer)
      if (score == null) {
        block(c, g.optString("waiting"), pad, end - 40f, inner, body, 2)
      } else {
        if (b != Bucket.SMALL && asleep != null) block(c, "$asleep.", pad, pad + 32f, inner, sentence(18f), 2)
        val barY = end - 8f
        stageBar(c, parts, pad, barY, inner, 8f)
        val dot = if (b == Bucket.SMALL) DotFont.fit(score, 4.5f, inner) else 4.5f
        val numH = DotFont.height(dot)
        val top = barY - 14f - numH
        DotFont.draw(c, score, pad, top, dot)
        val label = if (b == Bucket.SMALL) (asleep ?: g.optString("word")) else g.optString("word")
        line(c, label, pad + DotFont.width(score, dot) + 10f, top + numH - 17f, inner - DotFont.width(score, dot) - 10f, body)
        if (b == Bucket.LARGE) legend(c, parts, pad, top - 26f, inner)
      }
      footerLine(c, footer, w, h, pad)
    }
    return Triple(bmp, listOfNotNull(title, asleep, score?.let { "${g.optString("word")} $it" } ?: g.optString("waiting")).joinToString(". "), g.optString("href"))
  }

  private fun stageBar(c: Canvas, parts: List<Triple<String, Float, Int>>, x: Float, y: Float, w: Float, h: Float) {
    val total = parts.sumOf { it.second.toDouble() }.toFloat()
    val p = Paint(Paint.ANTI_ALIAS_FLAG)
    if (total <= 0f) { p.color = 0x14FFFFFF; c.drawRoundRect(RectF(x, y, x + w, y + h), h / 2, h / 2, p); return }
    val shown = parts.filter { it.second > 0f }
    val gap = 2f
    val room = w - gap * (shown.size - 1)
    var x0 = x
    shown.forEach { (_, minutes, color) ->
      val pw = max(2f, minutes / total * room)
      p.color = color
      c.drawRoundRect(RectF(x0, y, x0 + pw, y + h), h / 2, h / 2, p)
      x0 += pw + gap
    }
  }

  private fun legend(c: Canvas, parts: List<Triple<String, Float, Int>>, x: Float, y: Float, w: Float) {
    val names = mapOf("deep" to R.string.glow_widget_stage_deep, "rem" to R.string.glow_widget_stage_rem, "light" to R.string.glow_widget_stage_light, "awake" to R.string.glow_widget_stage_awake)
    var x0 = x
    val p = text(sans, 11f, 0xB8FFFFFF.toInt())
    val mark = Paint(Paint.ANTI_ALIAS_FLAG)
    parts.forEach { (k, minutes, color) ->
      val label = "${context.getString(names.getValue(k))} ${minutes.toInt() / 60}:${(minutes.toInt() % 60).toString().padStart(2, '0')}"
      val need = 12f + p.measureText(label) + 12f
      if (x0 + need > x + w) return
      mark.color = color
      c.drawRoundRect(RectF(x0, y + 4f, x0 + 8f, y + 12f), 2f, 2f, mark)
      c.drawText(label, x0 + 12f, y - p.fontMetrics.ascent, p)
      x0 += need
    }
  }

  // ── Steps ─────────────────────────────────────────────────────────────────

  private fun steps(g: JSONObject, b: Bucket, w: Float, h: Float, r: Float, pad: Float, footer: String?): Triple<Bitmap, String, String> {
    val title = g.optString("title")
    val value = g.optString("value").ifBlank { "0" }
    val goal = g.optString("goal")
    val share = g.optDouble("share", 0.0).toFloat().coerceIn(0f, 1f)
    val word = g.optString("word")
    val week = g.optJSONArray("week").numbers()
    val bmp = blank(w, h) { c ->
      drawGlow(c, Look.lime(Ink.steps), w, h, r)
      val inner = w - pad * 2
      val goalW = if (b == Bucket.SMALL || goal.isBlank()) 0f else note.measureText(goal) + 4f
      line(c, title, pad, pad, inner - goalW - 8f, this.title)
      if (goalW > 0f) line(c, goal, pad + inner - goalW, pad + 2f, goalW, note, right = true)
      val end = bottom(h, pad, footer)
      val dot = DotFont.fit(value, if (b == Bucket.SMALL) 3.6f else 4.5f, inner)
      val numH = DotFont.height(dot)
      val wordH = 18f
      if (b == Bucket.LARGE && week.size == 7) rings(c, week, pad, pad + 40f, inner)
      levelBar(c, share, pad, end - wordH - 10f - numH - 20f, inner)
      DotFont.draw(c, value, pad, end - wordH - 6f - numH, dot)
      line(c, word, pad, end - wordH, inner, text(sans, 13f, 0xDBFFFFFF.toInt()))
      footerLine(c, footer, w, h, pad)
    }
    return Triple(bmp, listOf(title, value, word).filter { it.isNotBlank() }.joinToString(". "), g.optString("href"))
  }

  private fun levelBar(c: Canvas, share: Float, x: Float, y: Float, w: Float) {
    val p = Paint(Paint.ANTI_ALIAS_FLAG)
    p.color = 0x24FFFFFF; c.drawRoundRect(RectF(x, y, x + w, y + 6f), 3f, 3f, p)
    p.color = 0xFFFFFFFF.toInt(); c.drawRoundRect(RectF(x, y, x + max(6f, w * share), y + 6f), 3f, 3f, p)
  }

  private fun rings(c: Canvas, shares: List<Float?>, x: Float, y: Float, w: Float) {
    val size = min(30f, w / 7f - 6f)
    val step = (w - size) / 6f
    val track = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeWidth = 3f; color = 0x29FFFFFF }
    val arc = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeWidth = 3f; strokeCap = Paint.Cap.ROUND; color = 0xFFFFFFFF.toInt() }
    shares.forEachIndexed { i, s ->
      val box = RectF(x + i * step + 2f, y + 2f, x + i * step + size - 2f, y + size - 2f)
      c.drawOval(box, track)
      val v = (s ?: 0f).coerceIn(0f, 1f)
      if (v > 0f) c.drawArc(box, -90f, if (v >= 1f) 359.9f else v * 360f, false, arc)
    }
  }
}

private fun JSONArray?.numbers(): List<Float?> {
  if (this == null) return emptyList()
  return (0 until length()).map { i -> if (isNull(i)) null else optDouble(i, Double.NaN).takeIf { it.isFinite() }?.toFloat() }
}
