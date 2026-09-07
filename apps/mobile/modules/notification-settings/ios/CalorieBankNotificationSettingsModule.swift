import ExpoModulesCore
import UIKit

public class CalorieBankNotificationSettingsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("CalorieBankNotificationSettings")

    AsyncFunction("openAsync") { (promise: Promise) in
      guard #available(iOS 16.0, *),
        let url = URL(string: UIApplication.openNotificationSettingsURLString) else {
        promise.resolve(false)
        return
      }
      UIApplication.shared.open(url, options: [:]) { opened in
        promise.resolve(opened)
      }
    }
    .runOnQueue(.main)
  }
}
