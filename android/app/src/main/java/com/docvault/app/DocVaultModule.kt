package com.docvault.app

import android.Manifest
import android.content.ContentValues
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.*
import java.io.File
import java.io.FileWriter

/**
 * DocVaultModule – native bridge for permissions, Downloads export, and device diagnostics.
 * Registered via DocVaultPackage and exposed to JS as 'DocVaultNative'.
 */
class DocVaultModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "DocVaultNative"

    /** Return a map of permission statuses for all storage-related permissions. */
    @ReactMethod
    fun checkPermissions(promise: Promise) {
        val ctx = reactApplicationContext
        val result = WritableNativeMap()
        val perms = buildList {
            add(Manifest.permission.READ_EXTERNAL_STORAGE)
            add(Manifest.permission.WRITE_EXTERNAL_STORAGE)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                add(Manifest.permission.READ_MEDIA_IMAGES)
                add(Manifest.permission.READ_MEDIA_VIDEO)
                add(Manifest.permission.READ_MEDIA_AUDIO)
            }
        }
        for (perm in perms) {
            val granted = ContextCompat.checkSelfPermission(ctx, perm) == PackageManager.PERMISSION_GRANTED
            result.putBoolean(perm.substringAfterLast('.'), granted)
        }
        result.putInt("sdkInt", Build.VERSION.SDK_INT)
        result.putString("release", Build.VERSION.RELEASE)
        promise.resolve(result)
    }

    /**
     * Save text content to the device Downloads folder.
     * Uses MediaStore on Android 10+, direct File on older versions.
     */
    @ReactMethod
    fun saveToDownloads(content: String, filename: String, mimeType: String, promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                // Android 10+ – use MediaStore (no WRITE_EXTERNAL_STORAGE needed)
                val resolver = reactApplicationContext.contentResolver
                val cv = ContentValues().apply {
                    put(MediaStore.Downloads.DISPLAY_NAME, filename)
                    put(MediaStore.Downloads.MIME_TYPE, mimeType)
                    put(MediaStore.Downloads.IS_PENDING, 1)
                }
                val collection = MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
                val uri: Uri = resolver.insert(collection, cv)
                    ?: throw Exception("MediaStore insert returned null URI")
                resolver.openOutputStream(uri)?.use { it.write(content.toByteArray()) }
                cv.clear()
                cv.put(MediaStore.Downloads.IS_PENDING, 0)
                resolver.update(uri, cv, null, null)
                promise.resolve(uri.toString())
            } else {
                // Android 9 and below – direct write to Downloads
                val dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
                dir.mkdirs()
                val file = File(dir, filename)
                FileWriter(file).use { it.write(content) }
                promise.resolve(file.absolutePath)
            }
        } catch (e: Exception) {
            promise.reject("SAVE_ERROR", "saveToDownloads failed: ${e.message}", e)
        }
    }

    /** Return diagnostic info about the app's private storage directories. */
    @ReactMethod
    fun getStorageInfo(promise: Promise) {
        val ctx = reactApplicationContext
        val result = WritableNativeMap()
        result.putString("filesDir", ctx.filesDir.absolutePath)
        result.putString("cacheDir", ctx.cacheDir.absolutePath)
        result.putString("externalFilesDir", ctx.getExternalFilesDir(null)?.absolutePath ?: "unavailable")
        result.putBoolean("filesExists", ctx.filesDir.exists())
        result.putBoolean("cacheExists", ctx.cacheDir.exists())
        result.putLong("filesDirFree", ctx.filesDir.freeSpace)
        result.putLong("cacheDirFree", ctx.cacheDir.freeSpace)
        promise.resolve(result)
    }

    /** Write a debug log entry to the app's private files/debug.log. */
    @ReactMethod
    fun appendDebugLog(entry: String, promise: Promise) {
        try {
            val file = File(reactApplicationContext.filesDir, "debug.log")
            file.appendText("$entry\n")
            promise.resolve(true)
        } catch (e: Exception) {
            promise.resolve(false) // never reject – debug logs are best-effort
        }
    }

    /** Read the debug log file. */
    @ReactMethod
    fun readDebugLog(promise: Promise) {
        try {
            val file = File(reactApplicationContext.filesDir, "debug.log")
            promise.resolve(if (file.exists()) file.readText() else "")
        } catch (e: Exception) {
            promise.reject("READ_ERROR", e.message, e)
        }
    }

    /** Clear the debug log file. */
    @ReactMethod
    fun clearDebugLog(promise: Promise) {
        try {
            File(reactApplicationContext.filesDir, "debug.log").delete()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }
}
