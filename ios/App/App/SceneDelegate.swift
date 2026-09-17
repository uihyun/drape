import UIKit
import Capacitor
import GoogleSignIn

// iOS 27 traps at launch (EXC_BREAKPOINT inside
// __UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption) for any app
// linked against the iOS 27 SDK that still uses the legacy UIApplication
// lifecycle. Capacitor 7.6's template is still legacy, so adopting UIScene is on
// us. 2.1.0 (16) was rejected under Guideline 2.1(a) for exactly this: it
// launched fine on iOS 26 and died before our first line of code on 27.
//
// The part that is easy to get wrong: once a scene manifest exists, UIKit STOPS
// calling `application(_:open:options:)` and `application(_:continue:)` on the
// AppDelegate. Google's OAuth callback and Sign in with Apple both arrive that
// way, so those hooks move here — otherwise the crash is fixed and sign-in
// silently breaks instead, which is worse.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    var window: UIWindow?

    func scene(_ scene: UIScene,
               willConnectTo session: UISceneSession,
               options connectionOptions: UIScene.ConnectionOptions) {
        // Main.storyboard still builds the CAPBridgeViewController; the manifest
        // names it via UISceneStoryboardFile, so UIKit has already attached the
        // window by the time we get here. Nothing to construct.

        // A cold start FROM a URL delivers it here rather than through
        // openURLContexts — this is the sign-in-from-Safari path.
        if let urlContext = connectionOptions.urlContexts.first {
            handle(url: urlContext.url)
        }
        for activity in connectionOptions.userActivities {
            continueActivity(activity)
        }
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        for context in URLContexts {
            handle(url: context.url)
        }
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        continueActivity(userActivity)
    }

    // Same order the AppDelegate used: Google first, then Capacitor's proxy for
    // Apple Sign-In, Universal Links and plugin-registered schemes.
    private func handle(url: URL) {
        if GIDSignIn.sharedInstance.handle(url) { return }
        ApplicationDelegateProxy.shared.application(
            UIApplication.shared, open: url, options: [:]
        )
    }

    private func continueActivity(_ userActivity: NSUserActivity) {
        ApplicationDelegateProxy.shared.application(
            UIApplication.shared,
            continue: userActivity,
            restorationHandler: { _ in }
        )
    }
}
