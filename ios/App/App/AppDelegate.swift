import UIKit
import Capacitor
import FirebaseCore

// Scene lifecycle is adopted — see SceneDelegate.swift and the
// UIApplicationSceneManifest in Info.plist — because iOS 27 traps at launch
// without it. That changes what this file is for: the window belongs to the
// scene, and UIKit no longer calls the URL, userActivity or foreground/
// background hooks here. What still runs on the app delegate is process-level
// setup like Firebase, plus the remote-notification callbacks Capacitor's
// plugins swizzle on.
//
// Deliberately NOT here any more:
//   application(_:open:options:)     — Google OAuth + Sign in with Apple
//   application(_:continue:)         — Universal Links
//   applicationDidBecomeActive(_:)   — and the rest of the lifecycle stubs
// All of those moved to SceneDelegate. Re-adding one here would compile, run,
// and silently never fire — a worse failure than the crash was.
@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // FirebaseApp.configure() is required by @capacitor-firebase/authentication
        // so the native Google sign-in plugin can hand off to FirebaseAuth.
        FirebaseApp.configure()
        return true
    }

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        UISceneConfiguration(name: "Default Configuration",
                             sessionRole: connectingSceneSession.role)
    }
}
