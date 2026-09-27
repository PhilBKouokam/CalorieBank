package com.caloriebank.keyboard

import android.graphics.Rect
import android.os.Build
import android.view.View
import android.view.ViewTreeObserver
import android.widget.ScrollView
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** Geometry only. Never reads text, changes window flags, or replaces inset listeners. */
class KeyboardGeometryModule : Module() {
  private data class Watch(val observer: ViewTreeObserver, val layout: ViewTreeObserver.OnGlobalLayoutListener,
                           val focus: ViewTreeObserver.OnGlobalFocusChangeListener)
  private val watches = mutableMapOf<Int, Watch>()

  private fun keyboardTop(view: View): Int? {
    val insets = ViewCompat.getRootWindowInsets(view) ?: return null
    if (!insets.isVisible(WindowInsetsCompat.Type.ime())) return null
    val activity = appContext.currentActivity ?: return null
    // Window metrics remain full-window even when adjustResize already reduces a child.
    // All view locations below use screen coordinates, not Fabric's visible-frame origin.
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      activity.windowManager.currentWindowMetrics.bounds.bottom -
        insets.getInsets(WindowInsetsCompat.Type.ime()).bottom
    } else {
      Rect().also { view.getWindowVisibleDisplayFrame(it) }.bottom
    }
  }

  private fun contains(parent: View, child: View?): Boolean {
    var current = child
    while (current != null) {
      if (current === parent) return true
      current = current.parent as? View
    }
    return false
  }

  private fun remove(tag: Int) {
    val watch = watches.remove(tag) ?: return
    if (watch.observer.isAlive) {
      watch.observer.removeOnGlobalLayoutListener(watch.layout)
      watch.observer.removeOnGlobalFocusChangeListener(watch.focus)
    }
  }

  override fun definition() = ModuleDefinition {
    Name("CalorieBankKeyboardGeometry")
    Events("geometryChanged")
    AsyncFunction("watch") { tag: Int ->
      remove(tag)
      val view = runCatching { appContext.findView<View>(tag) }.getOrNull() ?: return@AsyncFunction
      var previous: List<Int?>? = null
      fun notifyGeometry() {
        val location = IntArray(2)
        view.getLocationOnScreen(location)
        val focus = view.findFocus()
        val signature = listOf(location[0], location[1], view.width, view.height,
          keyboardTop(view), focus?.id)
        if (signature != previous) {
          previous = signature
          sendEvent("geometryChanged", mapOf("tag" to tag))
        }
      }
      val layout = ViewTreeObserver.OnGlobalLayoutListener { notifyGeometry() }
      val focus = ViewTreeObserver.OnGlobalFocusChangeListener { _, _ -> notifyGeometry() }
      view.viewTreeObserver.addOnGlobalLayoutListener(layout)
      view.viewTreeObserver.addOnGlobalFocusChangeListener(focus)
      watches[tag] = Watch(view.viewTreeObserver, layout, focus)
      notifyGeometry()
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("unwatch") { tag: Int -> remove(tag) }.runOnQueue(Queues.MAIN)
    AsyncFunction("measure") { outerTag: Int, scrollTag: Int ->
      val outer = runCatching { appContext.findView<View>(outerTag) }.getOrNull() ?: return@AsyncFunction null
      val scroll = runCatching { appContext.findView<View>(scrollTag) }.getOrNull() as? ScrollView ?: return@AsyncFunction null
      val density = outer.resources.displayMetrics.density.toDouble()
      val outerLocation = IntArray(2).also { outer.getLocationOnScreen(it) }
      val scrollLocation = IntArray(2).also { scroll.getLocationOnScreen(it) }
      val focus = (scroll.findFocus() as? android.widget.EditText)?.takeIf { contains(scroll, it) }
      val focusLocation = focus?.let { v -> IntArray(2).also { v.getLocationOnScreen(it) } }
      mapOf(
        "outerTop" to outerLocation[1] / density,
        "outerBottom" to (outerLocation[1] + outer.height) / density,
        "viewportTop" to scrollLocation[1] / density,
        "viewportBottom" to (scrollLocation[1] + scroll.height) / density,
        "keyboardTop" to keyboardTop(outer)?.div(density),
        "focusTop" to focusLocation?.get(1)?.div(density),
        "focusBottom" to focusLocation?.let { (it[1] + (focus?.height ?: 0)) / density },
        "scrollY" to scroll.scrollY / density
      )
    }.runOnQueue(Queues.MAIN)
    OnDestroy {
      appContext.currentActivity?.runOnUiThread { watches.keys.toList().forEach { remove(it) } }
    }
  }
}
