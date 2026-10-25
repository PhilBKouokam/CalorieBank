package com.caloriebank.keyboard

import com.facebook.react.uimanager.IllegalViewOperationException
import android.graphics.Rect
import android.os.Build
import android.view.View
import android.os.Handler
import android.os.Looper
import android.widget.ScrollView
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** Geometry only. Never reads text, changes window flags, or replaces inset listeners. */
class KeyboardGeometryModule : Module() {
  private val main = Handler(Looper.getMainLooper())
  private val keyboardObservers by lazy {
    KeyboardObserverRegistry({ appContext.currentActivity }, { tag ->
      // RN 0.81.5 Fabric getView throws this specific exception for a not-yet-mounted tag.
      try { appContext.findView<View>(tag) } catch (_: IllegalViewOperationException) { null }
    }) { tag, owner ->
      sendEvent("geometryChanged", mapOf("tag" to tag, "owner" to owner))
    }
  }

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

  override fun definition() = ModuleDefinition {
    Name("CalorieBankKeyboardGeometry")
    Events("geometryChanged")
    AsyncFunction("watch") { tag: Int, owner: String -> keyboardObservers.watch(tag, owner) }.runOnQueue(Queues.MAIN)
    AsyncFunction("unwatch") { tag: Int, owner: String -> keyboardObservers.unwatch(tag, owner) }.runOnQueue(Queues.MAIN)
    AsyncFunction("measure") { outerTag: Int, scrollTag: Int, owner: String ->
      val outer = runCatching { appContext.findView<View>(outerTag) }.getOrNull() ?: return@AsyncFunction null
      val scroll = runCatching { appContext.findView<View>(scrollTag) }.getOrNull() as? ScrollView ?: return@AsyncFunction null
      if (!keyboardObservers.owns(outerTag, owner, outer) || !scroll.isAttachedToWindow || !contains(outer, scroll)) return@AsyncFunction null
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
    OnActivityDestroys { main.post { keyboardObservers.clearDestroyedActivities() } }
    OnDestroy { main.post { keyboardObservers.clear() } }
  }
}
