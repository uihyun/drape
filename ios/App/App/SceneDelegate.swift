import UIKit
import Capacitor
import GoogleSignIn

// Capacitor 8.5's official scene delegate, plus one drape-specific hook.
//
// iOS 27 traps at launch for any app still on the legacy UIApplication
// lifecycle — that rejected 2.1.0 build 16 under Guideline 2.1(a). Capacitor 8.5
// adopts UIScene, and `npx cap migrate` generated everything below except the
// GIDSignIn line in openURLContexts.
//
// That line matters: with a scene manifest present UIKit stops calling
// `application(_:open:options:)`, where our Google OAuth callback used to be
// handled. `cap migrate` flags the stale method but does not move it, so fixing
// only the crash would have left sign-in quietly broken instead.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = CAPBridgeViewController()
        window?.makeKeyAndVisible()

        // A cold start FROM a URL delivers it here, not through openURLContexts.
        // Google first, same precedence as the live app.
        for context in connectionOptions.urlContexts where GIDSignIn.sharedInstance.handle(context.url) {
            break
        }

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        // GIDSignIn gets first refusal; anything it doesn't claim falls through to
        // Capacitor's plugin routing (Sign in with Apple, share-to-drape, deep links).
        let unclaimed = URLContexts.filter { !GIDSignIn.sharedInstance.handle($0.url) }
        guard !unclaimed.isEmpty else { return }
        SceneDelegateProxy.shared.scene(scene, openURLContexts: unclaimed)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
