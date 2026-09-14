import UIKit
import UniformTypeIdentifiers

// Share-to-drape (SPEC-1.6 §A, iOS half — v1: links/text only).
// Grabs the shared URL (or text containing one), hands it to the host app
// via drape://import?…, and dismisses itself. Images are deferred to v2
// (they need an App Group container; links are the killer use case:
// "saw this on a shop page → would it suit me?").
class ShareViewController: UIViewController {

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        handleShare()
    }

    private func handleShare() {
        let providers = (extensionContext?.inputItems as? [NSExtensionItem])?
            .flatMap { $0.attachments ?? [] } ?? []

        if let p = providers.first(where: { $0.hasItemConformingToTypeIdentifier(UTType.url.identifier) }) {
            p.loadItem(forTypeIdentifier: UTType.url.identifier) { [weak self] item, _ in
                let url = (item as? URL)?.absoluteString ?? ""
                DispatchQueue.main.async { self?.openApp(query: "url=" + Self.enc(url)) }
            }
            return
        }
        if let p = providers.first(where: { $0.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) }) {
            p.loadItem(forTypeIdentifier: UTType.plainText.identifier) { [weak self] item, _ in
                let text = (item as? String) ?? ""
                DispatchQueue.main.async { self?.openApp(query: "text=" + Self.enc(text)) }
            }
            return
        }
        complete()
    }

    private static func enc(_ s: String) -> String {
        return s.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? ""
    }

    private func openApp(query: String) {
        guard let url = URL(string: "drape://import?src=ios&" + query) else { return complete() }
        // Share extensions have no UIApplication.shared; try the modern
        // extensionContext.open first, then the responder-chain fallback.
        extensionContext?.open(url) { [weak self] ok in
            if ok { self?.complete(); return }
            DispatchQueue.main.async {
                var responder: UIResponder? = self
                while let r = responder {
                    if let app = r as? UIApplication {
                        app.open(url, options: [:], completionHandler: nil)
                        break
                    }
                    responder = r.next
                }
                self?.complete()
            }
        }
    }

    private func complete() {
        extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
    }
}
