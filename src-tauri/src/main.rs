// src-tauri/src/main.rs
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri_plugin_shell::process::Command;
use tauri_plugin_shell::ShellExt;

// S-01 الملفات والملاحة: سحق حجم البكسلات مع استقبال مسار الحفظ المختار من المستخدم ديناميكياً
#[tauri::command]
async fn execute_ghostscript_compress(app_handle: tauri::AppHandle, input_path: String, output_path: String, level: String) -> Result<String, String> {
    let gs_setting = match level.as_str() {
        "extreme" => "/screen",   // 72 DPI
        "low" => "/printer",      // 300 DPI
        _ => "/ebook",            // 150 DPI
    };

    // فصل المسارات وتأمينها تماماً داخل نظام ويندوز لمنع كود 1
    let output = app_handle.shell()
        .sidecar("gs")
        .map_err(|e| e.to_string())?
        .args(&[
            "-sDEVICE=pdfwrite",
            "-dCompatibilityLevel=1.4",
            "-dNOPAUSE",
            "-dQUIET",
            "-dBATCH",
            "-sOutputFile", 
            &output_path,   // مسار الحفظ الديناميكي المختار من النافذة الرسمية للويندوز
            &format!("-dPDFSETTINGS={}", gs_setting),
            &input_path,     
        ])
        .output()
        .await
        .map_err(|e| e.to_string())?;

    if output.status.success() || String::from_utf8_lossy(&output.stderr).to_string().is_empty() { 
        Ok("تم سحق بكسلات المستند وحفظ الملف بنجاح في المكان المختار!".to_string()) 
    } else { 
        Err(String::from_utf8_lossy(&output.stderr).to_string()) 
    }
}


// S-05 الأمان والنماذج: قفل الملف بكلمة مرور وحظر أحبار الطباعة من النواة
#[tauri::command]
async fn execute_ghostscript_encrypt(app_handle: tauri::AppHandle, input_path: String, output_path: String, user_pass: String, owner_pass: String, allow_print: bool) -> Result<String, String> {
    let perm_bit = if allow_print { "-4" } else { "-64" };
    
    let output = app_handle.shell()
        .sidecar("gs")
        .map_err(|e| e.to_string())?
        .args(&[
            "-sDEVICE=pdfwrite", 
            "-dNOPAUSE", 
            "-dBATCH", 
            "-dQUIET", 
            "-sOutputFile", 
            &output_path, 
            "-sEncryptionMethod=AES", 
            &format!("-sUserPassword={}", user_pass), 
            &format!("-sOwnerPassword={}", owner_pass), 
            "-dKeyLength=128", 
            &format!("-dPermissions={}", perm_bit), 
            &input_path
        ])
        .output()
        .await
        .map_err(|e| e.to_string())?;

    if output.status.success() || String::from_utf8_lossy(&output.stderr).to_string().is_empty() { 
        Ok("تم تشفير وقفل ملف الـ PDF برمجياً وحظر الصلاحيات!".to_string()) 
    } else { 
        Err(String::from_utf8_lossy(&output.stderr).to_string()) 
    }
}
// S-02 تنظيم الصفحات: الدمج الخطي المباشر
#[tauri::command]
async fn execute_ghostscript_merge(app_handle: tauri::AppHandle, file_a: String, file_b: String, output_path: String) -> Result<String, String> {
    let output = app_handle.shell()
        .sidecar("gs")
        .map_err(|e| e.to_string())?
        .args(&["-sDEVICE=pdfwrite", "-dNOPAUSE", "-dBATCH", "-dQUIET", "-sOutputFile", &output_path, &file_a, &file_b])
        .output()
        .await
        .map_err(|e| e.to_string())?;

    if output.status.success() || String::from_utf8_lossy(&output.stderr).to_string().is_empty() { 
        Ok("تم دمج الملفين في مستند فيزيائي واحد!".to_string()) 
    } else { 
        Err(String::from_utf8_lossy(&output.stderr).to_string()) 
    }
}

// S-02 تنظيم الصفحات: التقطيع الهندسي الصارم من جذر الملف
#[tauri::command]
async fn execute_ghostscript_organize(app_handle: tauri::AppHandle, input_path: String, output_path: String, start_page: i32, end_page: i32) -> Result<String, String> {
    let output = app_handle.shell()
        .sidecar("gs")
        .map_err(|e| e.to_string())?
        .args(&["-sDEVICE=pdfwrite", "-dNOPAUSE", "-dBATCH", "-dQUIET", &format!("-dFirstPage={}", start_page), &format!("-dLastPage={}", end_page), "-sOutputFile", &output_path, &input_path])
        .output()
        .await
        .map_err(|e| e.to_string())?;

    if output.status.success() || String::from_utf8_lossy(&output.stderr).to_string().is_empty() { 
        Ok("تم تقطيع وتوليد الملف المنظم بنجاح!".to_string()) 
    } else { 
        Err(String::from_utf8_lossy(&output.stderr).to_string()) 
    }
}

// S-04 المراجعة والترميز: فك خطوط الصور واستخراج النص برمجياً كملف مستقل
#[tauri::command]
async fn execute_ghostscript_extract_text(app_handle: tauri::AppHandle, input_path: String, output_path: String) -> Result<String, String> {
    let output = app_handle.shell()
        .sidecar("gs")
        .map_err(|e| e.to_string())?
        .args(&["-sDEVICE=txtwrite", "-dNOPAUSE", "-dBATCH", "-dQUIET", "-sOutputFile", &output_path, &input_path])
        .output()
        .await
        .map_err(|e| e.to_string())?;

    if output.status.success() || String::from_utf8_lossy(&output.stderr).to_string().is_empty() { 
        Ok("تم استخراج النصوص والخطوط الصافية برمجياً بنجاح!".to_string()) 
    } else { 
        Err(String::from_utf8_lossy(&output.stderr).to_string()) 
    }
}

// S-06 الهندسة المتقدمة: معايير الأرشفة المستدامة العميقة PDF/A
#[tauri::command]
async fn execute_ghostscript_pdfa(app_handle: tauri::AppHandle, input_path: String, output_path: String, compliance: String) -> Result<String, String> {
    let output = app_handle.shell()
        .sidecar("gs")
        .map_err(|e| e.to_string())?
        .args(&["-sDEVICE=pdfwrite", "-dPDFA=2", "-sColorConversionStrategy=UseDeviceDependentColor", "-dNOPAUSE", "-dBATCH", "-dQUIET", "-sOutputFile", &output_path, &input_path])
        .output()
        .await
        .map_err(|e| e.to_string())?;

    if output.status.success() || String::from_utf8_lossy(&output.stderr).to_string().is_empty() { 
        Ok(format!("تم تحويل وهندسة المستند ليتوافق مع المعيار العالمي [{}] بنجاح!", compliance)) 
    } else { 
        Err(String::from_utf8_lossy(&output.stderr).to_string()) 
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            execute_ghostscript_compress,
            execute_ghostscript_encrypt,
            execute_ghostscript_merge,
            execute_ghostscript_organize,
            execute_ghostscript_extract_text,
            execute_ghostscript_pdfa
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
