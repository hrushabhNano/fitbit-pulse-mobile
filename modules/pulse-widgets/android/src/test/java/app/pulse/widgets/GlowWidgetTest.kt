package app.pulse.widgets

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.BitmapDrawable
import android.view.View
import android.widget.ImageView
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File
import java.time.Instant

/** Draws every glow widget at a Small, a Wide and a Large from snapshots of the demo data, and saves them for review. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class GlowWidgetTest {
  private val sizes = listOf("small" to (170 to 170), "wide" to (360 to 170), "large" to (360 to 360))
  private fun fixture(name: String) = JSONObject(javaClass.classLoader!!.getResource("glow-snapshot-$name.json")!!.readText())
  private fun nowFor(name: String) = Instant.parse(when (name) { "waking" -> "2026-10-02T02:00:00Z"; "evening" -> "2026-10-02T15:00:00Z"; else -> "2026-10-02T08:30:00Z" }).epochSecond

  private fun render(kind: GlowKind, snapshot: JSONObject?, now: Long, w: Int, h: Int, name: String): Bitmap {
    val context = RuntimeEnvironment.getApplication() as Context
    val view = glowViews(context, 7, kind, snapshot, w.toFloat(), h.toFloat(), now).apply(context, null)
    val density = context.resources.displayMetrics.density
    val pw = (w * density).toInt(); val ph = (h * density).toInt()
    view.measure(View.MeasureSpec.makeMeasureSpec(pw, View.MeasureSpec.EXACTLY), View.MeasureSpec.makeMeasureSpec(ph, View.MeasureSpec.EXACTLY))
    view.layout(0, 0, pw, ph)
    val image = view.findViewById<ImageView>(R.id.glow_art)
    val art = (image.drawable as? BitmapDrawable)?.bitmap
    assertNotNull("$name has no bitmap", art)
    assertTrue("$name has no description", !image.contentDescription.isNullOrBlank())
    val out = Bitmap.createBitmap(pw, ph, Bitmap.Config.ARGB_8888)
    view.draw(Canvas(out))
    File("build/widget-previews").apply { mkdirs() }.let { dir -> File(dir, "glow-$name.png").outputStream().use { out.compress(Bitmap.CompressFormat.PNG, 100, it) } }
    return art!!
  }

  @Test fun everyWidgetAtEverySizeAndMoment() {
    for (moment in listOf("waking", "midday", "evening")) {
      val snapshot = fixture(moment)
      for (kind in GlowKind.values()) for ((size, wh) in sizes) {
        if (kind != GlowKind.TODAY && moment != "midday") continue
        val art = render(kind, snapshot, nowFor(moment), wh.first, wh.second, "${kind.name.lowercase()}-$size-$moment")
        // The light reaches the card: not one flat colour.
        val a = art.getPixel(art.width / 8, art.height - art.height / 8)
        val b = art.getPixel(art.width - art.width / 8, art.height / 8)
        assertTrue("${kind.name} $size $moment looks flat", a != b)
      }
    }
  }

  @Test fun anotherDayOrNoDataShowsTheWaitingCard() {
    val snapshot = fixture("midday")
    for (kind in GlowKind.values()) {
      val old = render(kind, snapshot, nowFor("midday") + 2 * 86_400, 170, 170, "${kind.name.lowercase()}-nextday")
      val none = render(kind, null, nowFor("midday"), 170, 170, "${kind.name.lowercase()}-empty")
      assertEquals(old.width, none.width)
    }
  }
}
