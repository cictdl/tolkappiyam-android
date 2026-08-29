package com.cict.tolkappiyam;

import android.annotation.SuppressLint;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.KeyEvent;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.webkit.ServiceWorkerClientCompat;
import androidx.webkit.ServiceWorkerControllerCompat;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewClientCompat;
import androidx.webkit.WebViewFeature;

/**
 * The whole portal is a single self-contained HTML file in assets/www. It is served
 * over the virtual https origin appassets.androidplatform.net rather than file://,
 * because the portal registers a service worker and uses localStorage — both of which
 * require a secure origin and are unavailable to file:// documents.
 */
public class MainActivity extends AppCompatActivity {

    private static final String DOMAIN = "appassets.androidplatform.net";
    private static final String START_URL = "https://" + DOMAIN + "/assets/www/index.html";

    private WebView webView;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        final WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
                .setDomain(DOMAIN)
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        // The service worker fetches through its own client, not the WebViewClient,
        // so it needs the same asset loader wired up or its install would 404.
        if (WebViewFeature.isFeatureSupported(WebViewFeature.SERVICE_WORKER_BASIC_USAGE)) {
            ServiceWorkerControllerCompat.getInstance().setServiceWorkerClient(
                    new ServiceWorkerClientCompat() {
                        @Nullable
                        @Override
                        public WebResourceResponse shouldInterceptRequest(@NonNull WebResourceRequest request) {
                            return assetLoader.shouldInterceptRequest(request.getUrl());
                        }
                    });
        }

        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setSupportZoom(true);
        settings.setBuiltInZoomControls(true);
        settings.setDisplayZoomControls(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setTextZoom(100);
        // Everything is bundled; nothing needs raw filesystem or content:// reach.
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        // Links marked target="_blank" should reach shouldOverrideUrlLoading rather
        // than silently requesting a second window we would have to manage.
        settings.setSupportMultipleWindows(false);

        webView.setWebViewClient(new WebViewClientCompat() {
            @Nullable
            @Override
            public WebResourceResponse shouldInterceptRequest(@NonNull WebView view,
                                                              @NonNull WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(@NonNull WebView view,
                                                    @NonNull WebResourceRequest request) {
                Uri url = request.getUrl();
                if (DOMAIN.equals(url.getHost())) {
                    return false; // in-app navigation within the bundled portal
                }
                return openExternally(url);
            }
        });

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        } else {
            webView.loadUrl(START_URL);
        }
    }

    /** Share links, the Digital Archives site and the Sangam index belong in a browser. */
    private boolean openExternally(Uri url) {
        String scheme = url.getScheme();
        if (scheme == null) {
            return true;
        }
        Intent intent = new Intent(Intent.ACTION_VIEW, url)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            startActivity(intent);
        } catch (ActivityNotFoundException e) {
            Toast.makeText(this, R.string.link_open_failed, Toast.LENGTH_SHORT).show();
        }
        return true;
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && webView != null && webView.canGoBack()) {
            webView.goBack();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onSaveInstanceState(@NonNull Bundle outState) {
        super.onSaveInstanceState(outState);
        webView.saveState(outState);
    }

    @Override
    protected void onPause() {
        webView.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        webView.onResume();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            // The portal drives speechSynthesis; leaving it running past the activity
            // would keep reading aloud after the user has left.
            webView.evaluateJavascript("try{speechSynthesis.cancel()}catch(e){}", null);
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
