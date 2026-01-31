package com.Tracker.app;

import android.util.Base64;
import android.util.Log;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.thegrizzlylabs.sardineandroid.DavResource;
import com.thegrizzlylabs.sardineandroid.Sardine;
import com.thegrizzlylabs.sardineandroid.impl.OkHttpSardine;
import com.thegrizzlylabs.sardineandroid.impl.SardineException;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.UnsupportedEncodingException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.List;

import okhttp3.Authenticator;
import okhttp3.Credentials;
import okhttp3.Interceptor;
import okhttp3.OkHttpClient;
import okhttp3.Protocol;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.Route;

@CapacitorPlugin(name = "WebdavPlugin")
public class WebdavPlugin extends Plugin {
    private static final String TAG = "WebdavPlugin";
    private static final String DEFAULT_SERVER_URL = "https://dav.jianguoyun.com/dav";
    private static final String DEFAULT_FOLDER = "TrackerBackups";

    private String ensureTrailingSlash(String url) {
        if (url == null || url.isEmpty()) return "";
        return url.endsWith("/") ? url : url + "/";
    }

    /**
     * 将文件名或路径处理为相对于 DEFAULT_FOLDER 的路径。
     * 如果 filename 不以 DEFAULT_FOLDER 开头，则自动补全。
     */
    private String normalizePath(String filename) {
        if (filename == null || filename.isEmpty()) return DEFAULT_FOLDER + "/";
        if (filename.startsWith("http://") || filename.startsWith("https://")) return filename;
        
        String path = filename.startsWith("/") ? filename.substring(1) : filename;
        if (!path.startsWith(DEFAULT_FOLDER + "/") && !path.equals(DEFAULT_FOLDER)) {
            path = DEFAULT_FOLDER + "/" + path;
        }
        return path;
    }

    private String buildUrl(String base, String path) {
        if (path != null && (path.startsWith("http://") || path.startsWith("https://"))) {
            return path;
        }
        String safeBase = ensureTrailingSlash(base == null || base.isEmpty() ? DEFAULT_SERVER_URL : base.trim());
        String normalizedPath = normalizePath(path);
        
        String[] parts = normalizedPath.split("/");
        StringBuilder encoded = new StringBuilder(safeBase);
        for (int i = 0; i < parts.length; i++) {
            String part = parts[i];
            if (part == null || part.isEmpty()) continue;
            try {
                // 兼容 API 24，使用字符串 "UTF-8"
                String enc = URLEncoder.encode(part, "UTF-8").replace("+", "%20");
                encoded.append(enc);
            } catch (UnsupportedEncodingException e) {
                encoded.append(part);
            }
            if (i < parts.length - 1 || normalizedPath.endsWith("/")) {
                encoded.append("/");
            }
        }
        return encoded.toString();
    }

    private void mkDirs(Sardine sardine, String serverUrl, String normalizedPath) {
        String safeBase = ensureTrailingSlash(serverUrl == null || serverUrl.isEmpty() ? DEFAULT_SERVER_URL : serverUrl.trim());
        String[] parts = normalizedPath.split("/");
        
        // 逐级创建目录
        StringBuilder currentPath = new StringBuilder();
        for (int i = 0; i < parts.length - (normalizedPath.endsWith("/") ? 0 : 1); i++) {
            if (parts[i] == null || parts[i].isEmpty()) continue;
            if (currentPath.length() > 0) currentPath.append("/");
            currentPath.append(parts[i]);
            
            String dirUrl = buildUrl(serverUrl, currentPath.toString() + "/");
            try {
                Log.d(TAG, "Ensuring directory: " + dirUrl);
                sardine.createDirectory(dirUrl);
            } catch (IOException e) {
                // 忽略 405 (已存在) 和 409 (冲突)
                if (e instanceof SardineException) {
                    int code = ((SardineException) e).getStatusCode();
                    if (code == 405 || code == 409) continue;
                }
            }
        }
    }

    private Sardine buildSardine(String username, String password) {
        Interceptor preemptiveAuth = chain -> {
            Request original = chain.request();
            String credential = Credentials.basic(username, password, StandardCharsets.UTF_8);
            return chain.proceed(original.newBuilder()
                    .header("Authorization", credential)
                    .header("User-Agent", "TrackerApp-WebDAV/1.0")
                    .build());
        };

        Authenticator authenticator = (route, response) -> {
            if (response.request().header("Authorization") != null) return null;
            String credential = Credentials.basic(username, password, StandardCharsets.UTF_8);
            return response.request().newBuilder().header("Authorization", credential).build();
        };

        OkHttpClient client = new OkHttpClient.Builder()
                .protocols(Collections.singletonList(Protocol.HTTP_1_1))
                .addInterceptor(preemptiveAuth)
                .authenticator(authenticator)
                .build();

        return new OkHttpSardine(client);
    }

    @PluginMethod
    public void upload(PluginCall call) {
        String serverUrl = call.getString("serverUrl", DEFAULT_SERVER_URL);
        String username = call.getString("username", "");
        String password = call.getString("password", "");
        String filename = call.getString("filename", "");
        String base64 = call.getString("base64", "");

        if (username.isEmpty() || password.isEmpty() || filename.isEmpty() || base64.isEmpty()) {
            call.reject("missing_parameters");
            return;
        }

        if (base64.contains(",")) {
            base64 = base64.substring(base64.indexOf(",") + 1);
        }

        final String finalBase64 = base64;
        getBridge().execute(() -> {
            try {
                Sardine sardine = buildSardine(username, password);
                String normalizedPath = normalizePath(filename);
                
                // 确保目录结构存在
                mkDirs(sardine, serverUrl, normalizedPath);

                String url = buildUrl(serverUrl, normalizedPath);
                byte[] data = Base64.decode(finalBase64, Base64.DEFAULT);
                Log.d(TAG, "Uploading to: " + url);
                sardine.put(url, data);
                call.resolve();
            } catch (Exception e) {
                Log.e(TAG, "Upload failed", e);
                call.reject("upload_failed: " + e.getLocalizedMessage());
            }
        });
    }

    @PluginMethod
    public void download(PluginCall call) {
        String serverUrl = call.getString("serverUrl", DEFAULT_SERVER_URL);
        String username = call.getString("username", "");
        String password = call.getString("password", "");
        String filename = call.getString("filename", "");

        getBridge().execute(() -> {
            try {
                Sardine sardine = buildSardine(username, password);
                String normalizedPath = normalizePath(filename);
                String url = buildUrl(serverUrl, normalizedPath);
                Log.d(TAG, "Downloading from: " + url);
                
                try (InputStream stream = sardine.get(url);
                     ByteArrayOutputStream buffer = new ByteArrayOutputStream()) {
                    byte[] data = new byte[8192];
                    int nRead;
                    while ((nRead = stream.read(data, 0, data.length)) != -1) {
                        buffer.write(data, 0, nRead);
                    }
                    JSObject result = new JSObject();
                    result.put("base64", Base64.encodeToString(buffer.toByteArray(), Base64.NO_WRAP));
                    call.resolve(result);
                }
            } catch (Exception e) {
                Log.e(TAG, "Download failed", e);
                call.reject("download_failed: " + e.getLocalizedMessage());
            }
        });
    }

    @PluginMethod
    public void list(PluginCall call) {
        String serverUrl = call.getString("serverUrl", DEFAULT_SERVER_URL);
        String username = call.getString("username", "");
        String password = call.getString("password", "");
        String path = call.getString("path", ""); // 可以为空，默认为 TrackerBackups

        getBridge().execute(() -> {
            try {
                Sardine sardine = buildSardine(username, password);
                String normalizedPath = normalizePath(path);
                if (!normalizedPath.endsWith("/")) normalizedPath += "/";
                
                String url = buildUrl(serverUrl, normalizedPath);
                Log.d(TAG, "Listing: " + url);
                
                List<DavResource> resources = sardine.list(url);
                JSArray items = new JSArray();
                for (DavResource res : resources) {
                    JSObject item = new JSObject();
                    item.put("name", res.getName());
                    item.put("path", res.getPath());
                    item.put("isDirectory", res.isDirectory());
                    item.put("size", res.getContentLength());
                    items.put(item);
                }
                JSObject result = new JSObject();
                result.put("items", items);
                call.resolve(result);
            } catch (Exception e) {
                Log.e(TAG, "List failed", e);
                call.reject("list_failed: " + e.getLocalizedMessage());
            }
        });
    }

    @PluginMethod
    public void exists(PluginCall call) {
        String serverUrl = call.getString("serverUrl", DEFAULT_SERVER_URL);
        String username = call.getString("username", "");
        String password = call.getString("password", "");
        String filename = call.getString("filename", "");

        getBridge().execute(() -> {
            try {
                Sardine sardine = buildSardine(username, password);
                String url = buildUrl(serverUrl, normalizePath(filename));
                JSObject result = new JSObject();
                result.put("exists", sardine.exists(url));
                call.resolve(result);
            } catch (Exception e) {
                call.reject("exists_failed: " + e.getLocalizedMessage());
            }
        });
    }

    @PluginMethod
    public void delete(PluginCall call) {
        String serverUrl = call.getString("serverUrl", DEFAULT_SERVER_URL);
        String username = call.getString("username", "");
        String password = call.getString("password", "");
        String filename = call.getString("filename", "");

        getBridge().execute(() -> {
            try {
                Sardine sardine = buildSardine(username, password);
                String url = buildUrl(serverUrl, normalizePath(filename));
                sardine.delete(url);
                call.resolve();
            } catch (Exception e) {
                call.reject("delete_failed: " + e.getLocalizedMessage());
            }
        });
    }
}
