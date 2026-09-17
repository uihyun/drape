import UIKit
import Capacitor
import FirebaseCore

// Capacitor 8.5 adopts the UIScene lifecycle (iOS 27 traps at launch without
// it), so the window and everything window-shaped now lives in SceneDelegate.
// What is left here is process-level setup and the scene configuration hook.
//
// Deliberately NOT here any more — `npx cap migrate` leaves these behind and
// only warns about them:
//   application(_:open:options:)     — Google OAuth + Sign in with Apple
//   application(_:continue:)         — Universal Links
//   applicationDidBecomeActive(_:)   — and the rest of the lifecycle stubs
//   var window: UIWindow?
// UIKit no longer calls any of them. Re-adding one compiles, runs, and silently
// never fires, which is a worse failure than the crash was. Their scene
// equivalents are in SceneDelegate.
@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // FirebaseApp.configure() is required by @capacitor-firebase/authentication
        // so the native Google sign-in plugin can hand off to FirebaseAuth.
        FirebaseApp.configure()
        return true
    }

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {

        let config = UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }
}
