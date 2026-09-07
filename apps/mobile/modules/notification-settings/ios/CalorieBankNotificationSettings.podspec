Pod::Spec.new do |s|
  s.name = 'CalorieBankNotificationSettings'
  s.version = '1.0.0'
  s.summary = 'Open the app notification settings using UIKit.'
  s.description = s.summary
  s.license = { :type => 'Proprietary' }
  s.author = 'CalorieBank'
  s.homepage = 'https://github.com/PhilBKouokam/CalorieBank'
  s.source = { :git => 'https://github.com/PhilBKouokam/CalorieBank.git' }
  s.platforms = { :ios => '15.1' }
  s.swift_version = '5.9'
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.swift'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
end
