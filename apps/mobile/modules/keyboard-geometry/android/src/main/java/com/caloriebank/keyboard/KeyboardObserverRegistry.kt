package com.caloriebank.keyboard

import android.app.Activity
import android.util.Log
import android.view.View
import android.view.ViewTreeObserver

/** Main-thread, event-driven registration. No timers or polling. */
internal class KeyboardObserverRegistry(
  private val currentActivity: () -> Activity?,
  private val resolve: (Int) -> View?,
  private val changed: (Int, String) -> Unit
) {
  private val entries = mutableMapOf<Int, Entry>()

  fun watch(tag: Int, owner: String): Map<String, String> {
    val activity = currentActivity() ?: return mapOf("status" to "pending", "reason" to "activity_unavailable")
    val previous = entries[tag]
    if (previous != null && previous.owner == owner && previous.activity === activity) return previous.reconcile()
    previous?.dispose()
    val entry = Entry(tag, owner, activity)
    entries[tag] = entry
    entry.start()
    return entry.reconcile()
  }

  fun unwatch(tag: Int, owner: String) {
    entries[tag]?.takeIf { it.owner == owner }?.dispose()
  }

  fun clearDestroyedActivities() = entries.values.toList().filter { it.activity.isDestroyed }.forEach { it.dispose() }

  fun clear() = entries.values.toList().forEach { it.dispose() }

  fun owns(tag: Int, owner: String, view: View): Boolean = entries[tag]?.let {
    it.owner == owner && it.activity === currentActivity() && it.target === view &&
      view.isAttachedToWindow && view.rootView === it.decor && it.observer?.isAlive == true
  } ?: false

  private inner class Entry(val tag: Int, val owner: String, val activity: Activity) {
    val decor: View = activity.window.decorView
    private val recoveryObserver = decor.viewTreeObserver
    var target: View? = null
    var observer: ViewTreeObserver? = null
    private var status = "pending"
    private val recovery = ViewTreeObserver.OnGlobalLayoutListener { reconcile() }
    private val layout = ViewTreeObserver.OnGlobalLayoutListener { notifyCurrent() }
    private val focus = ViewTreeObserver.OnGlobalFocusChangeListener { _, _ -> notifyCurrent() }
    private val attachment = object : View.OnAttachStateChangeListener {
      override fun onViewAttachedToWindow(v: View) { reconcile() }
      override fun onViewDetachedFromWindow(v: View) { detachObserver(); status = "pending" }
    }

    fun start() { recoveryObserver.addOnGlobalLayoutListener(recovery) }

    fun reconcile(): Map<String, String> {
      if (entries[tag] !== this || currentActivity() !== activity || activity.isDestroyed) {
        dispose()
        return mapOf("status" to "pending", "reason" to "activity_replaced")
      }
      val view = try { resolve(tag) } catch (error: Exception) {
        // Unknown failures are not converted to temporary absence or successful attachment.
        Log.e("CBKeyboardGeometry", "Observer registration failed (${error.javaClass.simpleName})")
        dispose()
        return mapOf("status" to "error", "reason" to "view_resolution_failed")
      }
      if (view !== target) {
        detachObserver()
        target?.removeOnAttachStateChangeListener(attachment)
        target = view
        view?.addOnAttachStateChangeListener(attachment)
      }
      if (view == null || !view.isAttachedToWindow || view.rootView !== decor) {
        detachObserver()
        status = "pending"
        return mapOf("status" to status, "reason" to "view_unavailable")
      }
      val current = view.viewTreeObserver
      if (observer !== current || observer?.isAlive != true) {
        detachObserver()
        observer = current
        current.addOnGlobalLayoutListener(layout)
        current.addOnGlobalFocusChangeListener(focus)
        status = "attached"
        notifyCurrent() // Keyboard may already be visible; do not wait for another IME event.
      }
      return mapOf("status" to status)
    }

    private fun notifyCurrent() {
      val view = target ?: return
      if (entries[tag] === this && owns(tag, owner, view)) changed(tag, owner)
    }

    private fun detachObserver() {
      // Android merges a floating ViewTreeObserver into the window observer on attachment.
      // Remove from both identities: the old instance may be dead while its listeners survived.
      setOfNotNull(observer, target?.viewTreeObserver).forEach { value ->
        if (value.isAlive) {
          value.removeOnGlobalLayoutListener(layout)
          value.removeOnGlobalFocusChangeListener(focus)
        }
      }
      observer = null
    }

    fun dispose() {
      if (entries[tag] === this) entries.remove(tag)
      detachObserver()
      target?.removeOnAttachStateChangeListener(attachment)
      target = null
      setOf(recoveryObserver, decor.viewTreeObserver).forEach {
        if (it.isAlive) it.removeOnGlobalLayoutListener(recovery)
      }
    }
  }
}
