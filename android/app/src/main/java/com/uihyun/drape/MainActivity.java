package com.uihyun.drape;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URLEncoder;

// Share-to-drape (SPEC-1.6 §A, Android half). ACTION_SEND lands here; we
// normalize it (image → cache file, link/text → query params) and route the
// WebView to the SPA's /import page, which owns the analyze→register flow.
// Best-effort by design: a malformed share must never crash the app.
public class MainActivity extends BridgeActivity {

    private static final long MAX_SHARED_IMAGE_BYTES = 25L * 1024 * 1024;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        handleShare(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleShare(intent);
    }

    private void handleShare(Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) return;
        String type = intent.getType();
        try {
            if (type != null && type.startsWith("image/")) {
                Uri uri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
                if (uri == null) return;
                File out = copySharedImage(uri);
                loadImport("file=" + URLEncoder.encode(out.getAbsolutePath(), "UTF-8"));
            } else {
                String text = intent.getStringExtra(Intent.EXTRA_TEXT);
                String subject = intent.getStringExtra(Intent.EXTRA_SUBJECT);
                StringBuilder q = new StringBuilder();
                if (text != null && !text.isEmpty()) {
                    q.append("text=").append(URLEncoder.encode(text, "UTF-8"));
                }
                if (subject != null && !subject.isEmpty()) {
                    if (q.length() > 0) q.append('&');
                    q.append("title=").append(URLEncoder.encode(subject, "UTF-8"));
                }
                if (q.length() > 0) loadImport(q.toString());
            }
        } catch (Exception ignored) {
            // Never let a share kill the launch; the app just opens normally.
        }
    }

    // Content URIs from other apps aren't readable by the WebView, so copy
    // the bytes into our cache where /_capacitor_file_ can serve them.
    private File copySharedImage(Uri uri) throws IOException {
        File out = new File(getCacheDir(), "shared-import-" + System.currentTimeMillis() + ".img");
        try (InputStream in = getContentResolver().openInputStream(uri);
             OutputStream os = new FileOutputStream(out)) {
            if (in == null) throw new IOException("unreadable stream");
            byte[] buf = new byte[64 * 1024];
            long total = 0;
            int n;
            while ((n = in.read(buf)) > 0) {
                total += n;
                if (total > MAX_SHARED_IMAGE_BYTES) throw new IOException("shared image too large");
                os.write(buf, 0, n);
            }
        }
        return out;
    }

    private void loadImport(String query) {
        final String url = getBridge().getLocalUrl() + "/import?src=android&" + query;
        getBridge().getWebView().post(() -> getBridge().getWebView().loadUrl(url));
    }
}
