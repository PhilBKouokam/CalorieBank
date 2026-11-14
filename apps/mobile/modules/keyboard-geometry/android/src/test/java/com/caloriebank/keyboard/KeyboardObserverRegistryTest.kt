package com.caloriebank.keyboard

import android.app.Activity
import android.view.View
import android.widget.FrameLayout
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [33])
class KeyboardObserverRegistryTest {
  private lateinit var activity: Activity
  private lateinit var parent: FrameLayout
  private var available: View? = null
  private val events = mutableListOf<Pair<Int, String>>()
  private lateinit var registry: KeyboardObserverRegistry

  @Before fun setup() {
    activity = Robolectric.buildActivity(Activity::class.java).setup().visible().get()
    parent = FrameLayout(activity)
    activity.setContentView(parent)
    registry = KeyboardObserverRegistry({ activity }, { available }) { tag, owner -> events.add(tag to owner) }
  }
  private fun view(): View = View(activity).also { parent.addView(it); available = it }
  private fun layout() = activity.window.decorView.viewTreeObserver.dispatchOnGlobalLayout()

  @Test fun missingViewRecoversOnLayoutWithoutAnotherWatch() {
    assertEquals("pending", registry.watch(10, "screen")["status"])
    assertTrue(events.isEmpty())
    val target = view()
    layout()
    assertTrue(registry.owns(10, "screen", target))
    assertTrue(events.contains(10 to "screen")) // initial measurement signal, keyboard may already be open
  }
  @Test fun detachedViewRecoversOnAttachment() {
    val target = View(activity)
    available = target
    assertEquals("pending", registry.watch(10, "screen")["status"])
    parent.addView(target)
    assertTrue(registry.owns(10, "screen", target))
    assertTrue(events.isNotEmpty())
  }
  @Test fun repeatedRegistrationDoesNotDuplicateListeners() {
    view()
    repeat(5) { assertEquals("attached", registry.watch(10, "screen")["status"]) }
    events.clear()
    layout()
    assertEquals(listOf(10 to "screen"), events)
  }
  @Test fun replacementViewDetachesOldOwner() {
    val old = view()
    registry.watch(10, "screen")
    parent.removeView(old)
    val replacement = view()
    layout()
    assertFalse(registry.owns(10, "screen", old))
    assertTrue(registry.owns(10, "screen", replacement))
    events.clear()
    old.viewTreeObserver.dispatchOnGlobalLayout()
    assertTrue(events.isEmpty())
  }
  @Test fun retiredLifetimeCannotUnwatchReplacement() {
    val target = view()
    registry.watch(10, "old")
    registry.watch(10, "new")
    registry.unwatch(10, "old")
    assertTrue(registry.owns(10, "new", target))
    events.clear()
    layout()
    assertEquals(listOf(10 to "new"), events)
  }
  @Test fun navigationCleanupRemovesAllCallbacks() {
    val target = view()
    registry.watch(10, "screen")
    registry.unwatch(10, "screen")
    events.clear()
    parent.removeView(target)
    parent.addView(target)
    layout()
    assertTrue(events.isEmpty())
    assertFalse(registry.owns(10, "screen", target))
  }
  @Test fun activityReplacementRejectsOldViewAndRecoversNewSurface() {
    val old = view()
    registry.watch(10, "old")
    val oldDecor = activity.window.decorView
    activity = Robolectric.buildActivity(Activity::class.java).setup().visible().get()
    parent = FrameLayout(activity)
    activity.setContentView(parent)
    val replacement = view()
    registry.watch(10, "new")
    events.clear()
    oldDecor.viewTreeObserver.dispatchOnGlobalLayout()
    assertTrue(events.isEmpty())
    assertFalse(registry.owns(10, "old", old))
    assertTrue(registry.owns(10, "new", replacement))
  }
  @Test fun unexpectedResolutionErrorIsExplicitAndNotRetried() {
    val failing = KeyboardObserverRegistry({ activity }, { throw IllegalStateException("test") }) { _, _ -> fail() }
    assertEquals("error", failing.watch(10, "screen")["status"])
    layout()
  }
}
