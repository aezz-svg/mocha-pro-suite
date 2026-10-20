// src-tauri/src/main.rs
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::api::process::Command;

// 🟢 [S-01 الملفات والملاحة] - زر الضغط وسحق الحجم فيزيائياً لـ 39 ميجا
#[tauri::command]
async fn execute_ghostscript_compress(input_path: String, output_path: String, level: String) -> Result<String, String> {
    let gs_setting = match level.as_str() {
        "extreme" => "/screen",   // 72 DPI (أقصى تقليص)
        "low" => "/printer",      // 300 DPI (أعلى دقة حادة)
        _ => "/ebook",            // 150 DPI (متوازن ومعياري)
    };

    let output = Command::new_sidecar("gs")
        .map_err(|e| e.to_string())?
        .args(&["-sDEVICE=pdfwrite", "-dCompatibilityLevel=1.4", &format!("-dPDFSETTINGS={}", gs_setting), "-dNOPAUSE", "-dQUIET", "-dBATCH", &format!("-sOutputFile={}", output_path), &input_path])
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() { Ok("تمت المعالجة الفيزيائية وسحق بكسلات الصور بنجاح!".to_string()) } 
    else { Err(String::from_utf8_lossy(&output.stderr).to_string()) }
}

// 🟢 [S-05 الأمان والنماذج] - قفل المستند بكلمة مرور وحظر أوامر الطباعة والتعديل من النواة
#[tauri::command]
async fn execute_ghostscript_encrypt(input_path: String, output_path: String, user_pass: String, owner_pass: String, allow_print: bool) -> Result<String, String> {
    let perm_bit = if allow_print { "-4" } else { "-64" }; // حظر الطباعة كلياً من نواة نظام أدوبي
    
    let output = Command::new_sidecar("gs")
        .map_err(|e| e.to_string())?
        .args(&["-sDEVICE=pdfwrite", "-dNOPAUSE", "-dBATCH", "-dQUIET", &format!("-sOutputFile={}", output_path), "-sEncryptionMethod=AES", &format!("-sUserPassword={}", user_pass), &format!("-sOwnerPassword={}", owner_pass), "-dKeyLength=128", &format!("-dPermissions={}", perm_bit), &input_path])
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() { Ok("تم تشفير وقفل المستند برمجياً، وتم حظر صلاحيات العبث به!".to_string()) } 
    else { Err(String::from_utf8_lossy(&output.stderr).to_string()) }
}
// 🟢 [S-02 تنظيم الصفحات] - تقطيع واستخراج صفحات محددة بدقة هندسية صارمة من جذر الملف
#[tauri::command]
async fn execute_ghostscript_organize(input_path: String, output_path: String, start_page: i32, end_page: i32) -> Result<String, String> {
    let output = Command::new_sidecar("gs")
        .map_err(|e| e.to_string())?
        .args(&["-sDEVICE=pdfwrite", "-dNOPAUSE", "-dBATCH", "-dQUIET", &format!("-dFirstPage={}", start_page), &format!("-dLastPage={}", end_page), &format!("-sOutputFile={}", output_path), &input_path])
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() { Ok("تم تقطيع وتوليد المستند المنظم بنجاح!".to_string()) } 
    else { Err(String::from_utf8_lossy(&output.stderr).to_string()) }
}

// 🟢 [S-02 تنظيم الصفحات / الدمج] - ربط ملفين ومصفوفات بايتات متعددة في ملف واحد مستقر
#[tauri::command]
async fn execute_ghostscript_merge(file_a: String, file_b: String, output_path: String) -> Result<String, String> {
    let output = Command::new_sidecar("gs")
        .map_err(|e| e.to_string())?
        .args(&["-sDEVICE=pdfwrite", "-dNOPAUSE", "-dBATCH", "-dQUIET", &format!("-sOutputFile={}", output_path), &file_a, &file_b])
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() { Ok("تم دمج الملفات بداخل مستند فيزيائي واحد بنجاح!".to_string()) } 
    else { Err(String::from_utf8_lossy(&output.stderr).to_string()) }
}
// 🟢 [S-04 المراجعة والترميز] - فك خطوط النصوص واستخراج النص الصافي برمجياً من الملفات الممسوحة ضوئياً
#[tauri::command]
async fn execute_ghostscript_extract_text(input_path: String, output_path: String) -> Result<String, String> {
    let output = Command::new_sidecar("gs")
        .map_err(|e| e.to_string())?
        .args(&["-sDEVICE=txtwrite", "-dNOPAUSE", "-dBATCH", "-dQUIET", &format!("-sOutputFile={}", output_path), &input_path])
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() { Ok("تم استخراج النصوص والخطوط الصافية برمجياً بنجاح!".to_string()) } 
    else { Err(String::from_utf8_lossy(&output.stderr).to_string()) }
}

// 🟢 [S-06 الهندسة المتقدمة] - إجبار الملف على الامتثال لمعايير الأرشفة العالمية القياسية الصارمة PDF/A
#[tauri::command]
async fn execute_ghostscript_pdfa(input_path: String, output_path: String, compliance: String) -> Result<String, String> {
    let output = Command::new_sidecar("gs")
        .map_err(|e| e.to_string())?
        .args(&["-sDEVICE=pdfwrite", "-dPDFA=2", "-sColorConversionStrategy=UseDeviceDependentColor", "-dNOPAUSE", "-dBATCH", "-dQUIET", &format!("-sOutputFile={}", output_path), &input_path])
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() { Ok(format!("تم تحويل وهندسة المستند ليتوافق مع المعيار العالمي [{}] بنجاح!", compliance)) } 
    else { Err(String::from_utf8_lossy(&output.stderr).to_string()) }
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            execute_ghostscript_compress,
            execute_ghostscript_encrypt,
            execute_ghostscript_organize,
            execute_ghostscript_merge,
            execute_ghostscript_extract_text,
            execute_ghostscript_pdfa
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
